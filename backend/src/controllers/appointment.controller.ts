import { Request, Response } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { successResponse, errorResponse } from '../utils/response';
import { createAppointmentSchema, verifyPaymentSchema } from '../validators/schemas';

export class AppointmentController {
  static async createAppointment(req: Request, res: Response) {
    try {
      const validated = createAppointmentSchema.parse(req.body);
      const result = await AppointmentService.createPendingAppointment(validated);

      return successResponse(
        res,
        result,
        'Pending appointment created. Please proceed to payment to confirm your booking.',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create appointment', 400, error.errors);
    }
  }

  static async confirmPayment(req: Request, res: Response) {
    try {
      const validated = verifyPaymentSchema.parse(req.body);
      const result = await AppointmentService.confirmAppointmentPayment(validated);

      return successResponse(
        res,
        result,
        'Payment verified successfully. Appointment confirmed & Digital OP generated!'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Payment verification failed', 400);
    }
  }

  static async getAppointment(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const appointment = await AppointmentService.getAppointmentById(id);

      if (!appointment) {
        return errorResponse(res, 'Appointment not found', 404);
      }

      return successResponse(res, appointment, 'Appointment details fetched');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch appointment', 500);
    }
  }

  static async getQueueStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const queue = await AppointmentService.getQueueStatus(id);

      if (!queue) {
        return errorResponse(res, 'Appointment not found', 404);
      }

      return successResponse(res, queue, 'Live queue status retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve queue status', 500);
    }
  }

  static async verifyOpToken(req: Request, res: Response) {
    try {
      const token = req.params.token as string;
      const result = await AppointmentService.verifyOpToken(token);

      if (!result) {
        return errorResponse(res, 'Invalid or expired Digital OP verification token', 404);
      }

      return successResponse(res, result, 'Digital OP verification successful');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Verification error', 500);
    }
  }

  static async downloadPdf(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const pdfBuffer = await AppointmentService.generatePdf(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Digital_OP_${id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate PDF', 500);
    }
  }

  static async cancelAppointment(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { cancellationReason } = req.body;
      if (!cancellationReason || cancellationReason.trim().length < 3) {
        return errorResponse(res, 'Cancellation reason is required (min 3 characters)', 400);
      }

      const cancelled = await AppointmentService.cancelAppointment(
        id,
        cancellationReason.trim(),
        req.user?.id
      );
      return successResponse(res, cancelled, 'Appointment cancelled successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to cancel appointment', 400);
    }
  }

  static async getPrescription(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const prescription = await AppointmentService.getAppointmentPrescription(id);
      return successResponse(res, prescription, 'Prescription retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch prescription', 400);
    }
  }
}
