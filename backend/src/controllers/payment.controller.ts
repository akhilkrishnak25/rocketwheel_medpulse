import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { successResponse, errorResponse } from '../utils/response';

export class PaymentController {
  static async createOrder(req: Request, res: Response) {
    try {
      const { appointmentId, amount, receipt } = req.body;
      if (!appointmentId || !amount) {
        return errorResponse(res, 'appointmentId and amount are required', 400);
      }

      const order = await PaymentService.createOrder({
        appointmentId,
        amount: Number(amount),
        receipt: receipt || `rec_${Date.now()}`,
      });

      return successResponse(res, order, 'Razorpay order generated');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create payment order', 500);
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature || !Buffer.isBuffer(req.body)) {
        return errorResponse(res, 'Invalid webhook request', 400);
      }

      const rawBody = req.body.toString('utf8');
      if (!PaymentService.verifyWebhookSignature(rawBody, signature)) {
        console.warn('Razorpay webhook signature verification failed');
        return errorResponse(res, 'Invalid webhook signature', 400);
      }

      const result = await PaymentService.handleWebhookEvent(JSON.parse(rawBody));
      return res.status(200).json({ status: 'ok', result });
    } catch (error: any) {
      console.error('Webhook error:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
