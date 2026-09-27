import { Request, Response } from 'express';
import { HospitalService } from '../services/hospital.service';
import { successResponse, errorResponse } from '../utils/response';

export class HospitalController {
  static async listHospitals(req: Request, res: Response) {
    try {
      const { search, city, department, isEmergencyAvailable, minRating, sortBy } = req.query;

      const hospitals = await HospitalService.getAllHospitals({
        search: search as string,
        city: city as string,
        department: department as string,
        isEmergencyAvailable: isEmergencyAvailable === 'true' ? true : isEmergencyAvailable === 'false' ? false : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        sortBy: sortBy as any,
      });

      return successResponse(res, hospitals, 'Hospitals fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hospitals', 500);
    }
  }

  static async getHospital(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const hospital = await HospitalService.getHospitalByIdOrSlug(id);

      if (!hospital) {
        return errorResponse(res, 'Hospital not found', 404);
      }

      return successResponse(res, hospital, 'Hospital details fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hospital details', 500);
    }
  }

  static async getHospitalDoctors(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { department, specialization, maxFee, search } = req.query;

      const doctors = await HospitalService.getHospitalDoctors(id, {
        department: department as string,
        specialization: specialization as string,
        maxFee: maxFee ? Number(maxFee) : undefined,
        search: search as string,
      });

      return successResponse(res, doctors, 'Hospital doctors fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch doctors for this hospital', 500);
    }
  }

  static async listDepartments(req: Request, res: Response) {
    try {
      const departments = await HospitalService.getPopularDepartments();
      return successResponse(res, departments, 'Departments fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch departments', 500);
    }
  }
}
