import crypto from 'crypto';
import nodemailer from 'nodemailer';
import prisma from '../config/prisma';
import { ENV } from '../config/env';

const hashOtp = (otpCode: string) => crypto.createHash('sha256').update(otpCode).digest('hex');

const smtpTransport = ENV.OTP_MODE === 'smtp'
  ? nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
    })
  : null;

export class OtpService {
  /**
   * Request OTP to look up appointment details without patient login
   */
  static async requestLookupOtp(appointmentNumberOrId: string, mobileNumber: string) {
    if (ENV.OTP_MODE === 'disabled') {
      throw new Error('Appointment OTP lookup is not configured yet');
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);

    // Verify that the appointment exists and belongs to this mobile number
    const appointment = await prisma.appointment.findFirst({
      where: {
        OR: [
          { id: appointmentNumberOrId },
          { appointmentNumber: appointmentNumberOrId },
          { digitalOp: { opNumber: appointmentNumberOrId } },
        ],
        patient: {
          mobileNumber: { contains: cleanMobile },
        },
      },
      include: {
        patient: true,
      },
    });

    if (!appointment) {
      throw new Error('No appointment found matching the provided Appointment / OP Number and Mobile Number.');
    }

    // Generate 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.otpVerification.create({
      data: {
        appointmentId: appointment.id,
        mobileNumber: cleanMobile,
        otpCode: hashOtp(otpCode),
        expiresAt,
      },
    });

    if (ENV.OTP_MODE === 'smtp') {
      if (!smtpTransport || !appointment.patient.email) {
        throw new Error('A patient email address is required for OTP lookup');
      }

      await smtpTransport.sendMail({
        from: ENV.OTP_FROM,
        to: appointment.patient.email,
        subject: 'Your MediPulse appointment verification code',
        text: `Your MediPulse verification code is ${otpCode}. It expires in 10 minutes.`,
      });
    } else {
      console.log(`Appointment OTP for local development: ${otpCode}`);
    }

    return {
      success: true,
      message: `OTP sent successfully to +91 ******${cleanMobile.slice(-4)}`,
      appointmentId: appointment.id,
      ...(ENV.OTP_MODE === 'console' ? { demoOtp: otpCode } : {}),
    };
  }

  /**
   * Verify OTP and return appointment & OP details
   */
  static async verifyLookupOtp(params: {
    appointmentNumberOrId: string;
    mobileNumber: string;
    otpCode: string;
  }) {
    const { appointmentNumberOrId, mobileNumber, otpCode } = params;
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);

    const appointment = await prisma.appointment.findFirst({
      where: {
        OR: [
          { id: appointmentNumberOrId },
          { appointmentNumber: appointmentNumberOrId },
          { digitalOp: { opNumber: appointmentNumberOrId } },
        ],
        patient: { mobileNumber: { contains: cleanMobile } },
      },
      include: {
        hospital: true,
        doctor: { include: { department: true } },
        patient: true,
        department: true,
        payment: true,
        digitalOp: true,
        prescription: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment details could not be retrieved.');
    }

    const otpRecords = await prisma.otpVerification.findMany({
      where: {
        appointmentId: appointment.id,
        mobileNumber: cleanMobile,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const otpRecord = otpRecords.find((record) => record.otpCode === hashOtp(otpCode));
    if (!otpRecord) {
      throw new Error('Invalid or expired OTP. Please verify and try again.');
    }

    if (otpRecord) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });
    }

    return appointment;
  }
}
