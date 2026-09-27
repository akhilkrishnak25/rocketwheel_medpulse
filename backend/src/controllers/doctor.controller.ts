import { Request, Response } from 'express';
import { DoctorService } from '../services/doctor.service';
import { successResponse, errorResponse } from '../utils/response';

export class DoctorController {
  static async listDoctors(req: Request, res: Response) {
    try {
      const { hospitalId, departmentId, search, city, specialization, sortBy } = req.query;
      const doctors = await DoctorService.listDoctors({
        hospitalId: hospitalId as string,
        departmentId: departmentId as string,
        search: search as string,
        city: city as string,
        specialization: specialization as string,
        sortBy: sortBy as any,
      });

      return successResponse(res, doctors, 'Doctors list retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to list doctors', 500);
    }
  }

  static async getDoctor(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const doctor = await DoctorService.getDoctorById(id);

      if (!doctor) {
        return errorResponse(res, 'Doctor not found', 404);
      }

      return successResponse(res, doctor, 'Doctor profile fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch doctor profile', 500);
    }
  }

  static async getDoctorSlots(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { date } = req.query;

      if (!date || typeof date !== 'string') {
        return errorResponse(res, 'Valid appointment date (YYYY-MM-DD) is required', 400);
      }

      const slots = await DoctorService.getAvailableSlots(id, date);
      return successResponse(res, slots, 'Available time slots retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to calculate available slots', 400);
    }
  }
}
