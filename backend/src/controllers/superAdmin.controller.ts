import { Request, Response } from 'express';
import { SuperAdminService } from '../services/superAdmin.service';
import { successResponse, errorResponse } from '../utils/response';
import {
  createHospitalSchema,
  updateHospitalSchema,
  createHospitalAdminSchema,
} from '../validators/schemas';

export class SuperAdminController {
  static async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await SuperAdminService.getPlatformMetrics();
      return successResponse(res, metrics, 'Platform-wide metrics retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch platform metrics', 500);
    }
  }

  static async getHospitals(req: Request, res: Response) {
    try {
      const hospitals = await SuperAdminService.getAllHospitals();
      return successResponse(res, hospitals, 'All registered hospitals retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hospitals', 500);
    }
  }

  static async getHospitalById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const hospital = await SuperAdminService.getHospitalById(id);
      if (!hospital) {
        return errorResponse(res, 'Hospital not found', 404);
      }
      return successResponse(res, hospital, 'Hospital details retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hospital', 500);
    }
  }

  static async createHospital(req: Request, res: Response) {
    try {
      const validated = createHospitalSchema.parse(req.body);
      const result = await SuperAdminService.createHospital(validated, req.user?.id);
      return successResponse(res, result, 'Hospital onboarded successfully into the network', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to onboard hospital', 400, error.errors);
    }
  }

  static async updateHospital(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const validated = updateHospitalSchema.parse(req.body);
      const updated = await SuperAdminService.updateHospital(id, validated, req.user?.id);
      return successResponse(res, updated, 'Hospital details updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update hospital', 400, error.errors);
    }
  }

  static async deleteHospital(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await SuperAdminService.deleteHospital(id, req.user?.id);
      return successResponse(res, result, 'Hospital removed from network');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete hospital', 400);
    }
  }

  static async getPendingHospitals(req: Request, res: Response) {
    try {
      const pending = await SuperAdminService.getPendingHospitals();
      return successResponse(res, pending, 'Pending hospitals retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch pending hospitals', 500);
    }
  }

  static async approveHospital(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const approved = await SuperAdminService.approveHospital(id, req.user?.userId);
      return successResponse(res, approved, 'Hospital approved and activated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to approve hospital', 400);
    }
  }

  static async rejectHospital(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason = 'Application does not meet platform accreditation standards.' } = req.body;
      const rejected = await SuperAdminService.rejectHospital(id, reason, req.user?.userId);
      return successResponse(res, rejected, 'Hospital registration rejected');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reject hospital', 400);
    }
  }

  static async toggleHospitalStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await SuperAdminService.toggleHospitalStatus(id, req.user?.userId);
      return successResponse(res, updated, `Hospital status updated to ${updated.status}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle hospital status', 400);
    }
  }

  static async createHospitalAdmin(req: Request, res: Response) {
    try {
      const hospitalId = req.params.id as string;
      const validated = createHospitalAdminSchema.parse(req.body);
      const admin = await SuperAdminService.createHospitalAdmin(hospitalId, validated, req.user?.id);
      return successResponse(res, admin, 'Hospital Administrator provisioned successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to provision admin', 400, error.errors);
    }
  }

  static async getAllDoctors(req: Request, res: Response) {
    try {
      const { search, hospitalId, departmentId } = req.query;
      const doctors = await SuperAdminService.getAllDoctors({
        search: search as string,
        hospitalId: hospitalId as string,
        departmentId: departmentId as string,
      });
      return successResponse(res, doctors, 'Network-wide doctors retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch doctors', 500);
    }
  }

  static async getAllAppointments(req: Request, res: Response) {
    try {
      const { date, status, hospitalId, limit } = req.query;
      const appointments = await SuperAdminService.getAllAppointments({
        date: date as string,
        status: status as string,
        hospitalId: hospitalId as string,
        limit: limit ? Number(limit) : undefined,
      });
      return successResponse(res, appointments, 'Platform appointments retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch appointments', 500);
    }
  }

  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await SuperAdminService.getAllUsers();
      return successResponse(res, users, 'System users retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch users', 500);
    }
  }

  static async getAuditLogs(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const logs = await SuperAdminService.getAuditLogs(limit ? Number(limit) : 50);
      return successResponse(res, logs, 'System audit logs retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch audit logs', 500);
    }
  }
}
