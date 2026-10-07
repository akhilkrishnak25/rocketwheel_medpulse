import { Request, Response } from 'express';
import { SupportStaffService } from '../services/supportStaff.service';
import { successResponse, errorResponse } from '../utils/response';
import { recordVitalsSchema } from '../validators/schemas';

export class SupportStaffController {
  static async getQueue(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this staff account', 400);
      }

      // Look up support staff record for current logged in user
      const staff = await SupportStaffService.getStaffByUserId(req.user?.userId || req.user?.id || '');
      const { date } = req.query;
      const queue = await SupportStaffService.getTodayQueue(hospitalId, staff?.id, date as string);
      return successResponse(res, queue, 'Today OP queue retrieved for vitals screening');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch queue', 500);
    }
  }

  static async recordVitals(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this staff account', 400);
      }

      const validated = recordVitalsSchema.parse(req.body);
      const vital = await SupportStaffService.recordVitals(
        hospitalId,
        validated,
        req.user?.id || 'staff',
        req.user?.email || 'Support Staff'
      );

      return successResponse(res, vital, 'Patient vitals recorded successfully. Patient added to doctor waiting queue.', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to record vitals', 400, error.errors);
    }
  }

  static async getVitals(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated', 400);
      }

      const appointmentId = req.params.appointmentId as string;
      const vitals = await SupportStaffService.getVitalsByAppointment(hospitalId, appointmentId);
      return successResponse(res, vitals, 'Appointment vitals retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch vitals', 500);
    }
  }
}
