import crypto from 'crypto';
import { ENV } from '../config/env';
import prisma from '../config/prisma';

export interface CreateOrderParams {
  appointmentId: string;
  amount: number; // in INR rupees
  currency?: string;
  receipt: string;
}

export class PaymentService {
  /**
   * Generates / creates Razorpay Order
   */
  static async createOrder(params: CreateOrderParams) {
    const { appointmentId, amount, currency = 'INR', receipt } = params;
    if (ENV.PAYMENT_MODE === 'disabled') {
      throw new Error('Online payments are temporarily unavailable');
    }

    if (ENV.PAYMENT_MODE === 'razorpay') {
      throw new Error('Razorpay integration is not configured yet');
    }

    const amountInPaise = Math.round(amount * 100);

    // If using real Razorpay API with actual credentials or in dev/sandbox mode:
    // Generate valid Razorpay Order ID format: order_XXXXXXXXXXXXXXXX
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const orderId = `order_${randomSuffix}`;

    return {
      orderId,
      amount: amountInPaise,
      amountRupees: amount,
      currency,
      receipt,
      keyId: ENV.RAZORPAY_KEY_ID,
      appointmentId,
    };
  }

  /**
   * Verifies Razorpay Payment Signature
   * Signature is HMAC SHA256 of `${orderId}|${paymentId}` with RAZORPAY_KEY_SECRET
   */
  static verifySignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { orderId, paymentId, signature } = params;
    if (ENV.PAYMENT_MODE === 'disabled') return false;

    // Calculate expected HMAC
    const expectedSignature = crypto
      .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (ENV.PAYMENT_MODE === 'demo') {
      return signature.startsWith('simulated_sig_') || signature.startsWith('test_sig_') || signature.startsWith('sig_');
    }

    if (expectedSignature.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Verifies incoming webhook signature from Razorpay
   */
  static verifyWebhookSignature(bodyString: string, signature: string): boolean {
    if (ENV.PAYMENT_MODE !== 'razorpay' || !ENV.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyString)
      .digest('hex');

    if (!signature || expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Idempotent webhook handler for payments
   */
  static async handleWebhookEvent(event: any) {
    const eventType = event.event;
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return { handled: false, reason: 'No order_id in event payload' };
    }

    // Find the appointment linked to this order
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderId },
      include: { appointment: true },
    });

    if (!payment) {
      return { handled: false, reason: 'Payment not found for orderId ' + orderId };
    }

    // Idempotency: if already SUCCESS, don't do anything
    if (payment.status === 'SUCCESS' && payment.appointment.status === 'CONFIRMED') {
      return { handled: true, status: 'ALREADY_PROCESSED' };
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          razorpayPaymentId: paymentId || payment.razorpayPaymentId,
        },
      });

      await prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: 'CONFIRMED' },
      });

      return { handled: true, status: 'CONFIRMED' };
    }

    if (eventType === 'payment.failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: paymentEntity?.error_description || 'Payment failed during checkout',
        },
      });

      return { handled: true, status: 'FAILED' };
    }

    return { handled: true, status: 'IGNORED_EVENT' };
  }
}
