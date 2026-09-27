import { Request, Response } from 'express';
import { OtpService } from '../services/otp.service';
import { successResponse, errorResponse } from '../utils/response';
import { sendOtpSchema, verifyOtpSchema } from '../validators/schemas';

export class OtpController {
  static async sendOtp(req: Request, res: Response) {
    try {
      const validated = sendOtpSchema.parse(req.body);
      const result = await OtpService.requestLookupOtp(
        validated.appointmentNumberOrId,
        validated.mobileNumber
      );

      return successResponse(res, result, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to send OTP', 400, error.errors);
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const validated = verifyOtpSchema.parse(req.body);
      const appointment = await OtpService.verifyLookupOtp(validated);

      return successResponse(
        res,
        appointment,
        'OTP verified successfully. Appointment retrieved.'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'OTP verification failed', 400);
    }
  }
}
