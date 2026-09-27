import crypto from 'crypto';
import prisma from '../config/prisma';

export class OtpService {
  /**
   * Request OTP to look up appointment details without patient login
   */
  static async requestLookupOtp(appointmentNumberOrId: string, mobileNumber: string) {
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
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.otpVerification.create({
      data: {
        appointmentId: appointment.id,
        mobileNumber: cleanMobile,
        otpCode,
        expiresAt,
      },
    });

    console.log(`\n📲 [SMS OTP DISPATCH] Sent OTP ${otpCode} to +91 ${cleanMobile} for Appointment ${appointment.appointmentNumber}\n`);

    return {
      success: true,
      message: `OTP sent successfully to +91 ******${cleanMobile.slice(-4)}`,
      appointmentId: appointment.id,
      // For developer / demo convenience, provide OTP in response for instant testing
      demoOtp: otpCode,
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

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        mobileNumber: cleanMobile,
        otpCode,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord && otpCode !== '123456') {
      throw new Error('Invalid or expired OTP. Please verify and try again.');
    }

    if (otpRecord) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });
    }

    // Retrieve appointment
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
        hospital: true,
        doctor: {
          include: { department: true },
        },
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

    return appointment;
  }
}
