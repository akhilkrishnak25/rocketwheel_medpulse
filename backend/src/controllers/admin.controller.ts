import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { AppointmentService } from '../services/appointment.service';
import { NotificationService } from '../services/notification.service';
import { successResponse, errorResponse } from '../utils/response';
import {
  updateAppointmentStatusSchema,
  createDoctorSchema,
  updateDoctorSchema,
  createDepartmentSchema,
  doctorLeaveSchema,
  doctorScheduleUpdateSchema,
  updateHospitalSchema,
  createOfflineAppointmentSchema,
  createSubAdminSchema,
  updateSubAdminPermissionsSchema,
} from '../validators/schemas';

export class AdminController {
  static async getMetrics(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const metrics = await AdminService.getDashboardMetrics(hospitalId);
      return successResponse(res, metrics, 'Hospital metrics retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch metrics', 500);
    }
  }

  static async getAppointments(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const { status, date, search, doctorId } = req.query;
      const appointments = await AdminService.getAppointments(hospitalId, {
        status: status as string,
        date: date as string,
        search: search as string,
        doctorId: doctorId as string,
      });

      return successResponse(res, appointments, 'Appointments retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch appointments', 500);
    }
  }

  static async updateAppointmentStatus(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const id = req.params.id as string;
      const validated = updateAppointmentStatusSchema.parse(req.body);

      const updated = await AdminService.updateAppointmentStatus(
        hospitalId,
        id,
        validated,
        req.user?.id
      );
      return successResponse(res, updated, `Appointment status updated to ${validated.status}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update appointment status', 400);
    }
  }

  static async getDoctors(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const doctors = await AdminService.getDoctors(hospitalId);
      return successResponse(res, doctors, 'Hospital doctors fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch doctors', 500);
    }
  }

  static async addDoctor(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const validated = createDoctorSchema.parse(req.body);
      const doctor = await AdminService.addDoctor(hospitalId, validated, req.user?.id);
      return successResponse(res, doctor, 'Doctor registered successfully with weekly schedules', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to register doctor', 400, error.errors);
    }
  }

  static async updateDoctor(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const doctorId = req.params.doctorId as string;
      const validated = updateDoctorSchema.parse(req.body);
      const updated = await AdminService.updateDoctor(hospitalId, doctorId, validated, req.user?.id);
      return successResponse(res, updated, 'Doctor profile updated');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update doctor', 400, error.errors);
    }
  }

  static async approveDoctor(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated with this admin account', 400);

      const doctorId = req.params.doctorId as string;
      const updated = await AdminService.approveDoctor(hospitalId, doctorId, req.user?.userId);
      return successResponse(res, updated, 'Doctor approved and activated');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to approve doctor', 400);
    }
  }

  static async rejectDoctor(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated with this admin account', 400);

      const doctorId = req.params.doctorId as string;
      const { reason } = req.body;
      const updated = await AdminService.rejectDoctor(hospitalId, doctorId, reason, req.user?.userId);
      return successResponse(res, updated, 'Doctor registration rejected');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reject doctor', 400);
    }
  }

  static async toggleDoctorStatus(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated with this admin account', 400);

      const doctorId = req.params.doctorId as string;
      const updated = await AdminService.toggleDoctorStatus(hospitalId, doctorId, req.user?.userId);
      return successResponse(res, updated, `Doctor status updated to ${updated.status}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle doctor status', 400);
    }
  }

  static async bulkImportDoctors(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated with this admin account', 400);

      const { csvData, rows, commit } = req.body;
      const input = csvData || rows;
      if (!input) return errorResponse(res, 'CSV data or rows array is required', 400);

      const result = await AdminService.bulkImportDoctors(hospitalId, input, Boolean(commit), req.user?.userId);
      return successResponse(
        res,
        result,
        commit ? `Successfully imported ${result.validCount} doctors` : 'CSV parsed and validated successfully'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Bulk import failed', 400);
    }
  }

  static async getDepartments(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const departments = await AdminService.getDepartments(hospitalId);
      return successResponse(res, departments, 'Departments fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch departments', 500);
    }
  }

  static async addDepartment(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const validated = createDepartmentSchema.parse(req.body);
      const dept = await AdminService.addDepartment(
        hospitalId,
        {
          name: validated.name,
          code: validated.code,
          description: validated.description || undefined,
          icon: validated.icon,
        },
        req.user?.userId
      );
      return successResponse(res, dept, 'Department added successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to add department', 400, error.errors);
    }
  }

  static async getDoctorSchedules(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const doctorId = req.params.doctorId as string;
      const schedules = await AdminService.getDoctorSchedules(hospitalId, doctorId);
      return successResponse(res, schedules, 'Doctor weekly schedules retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch schedules', 500);
    }
  }

  static async updateDoctorSchedules(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const doctorId = req.params.doctorId as string;
      const validated = doctorScheduleUpdateSchema.parse(req.body);
      const schedules = await AdminService.updateDoctorSchedules(hospitalId, doctorId, validated.schedules, req.user?.id);
      return successResponse(res, schedules, 'Doctor schedules updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update schedules', 400, error.errors);
    }
  }

  static async getDoctorLeaves(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const doctorId = req.params.doctorId as string;
      const leaves = await AdminService.getDoctorLeaves(hospitalId, doctorId);
      return successResponse(res, leaves, 'Doctor leaves retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch leaves', 500);
    }
  }

  static async addDoctorLeave(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const doctorId = req.params.doctorId as string;
      const validated = doctorLeaveSchema.parse(req.body);
      const leave = await AdminService.addDoctorLeave(hospitalId, doctorId, validated, req.user?.id);
      return successResponse(res, leave, 'Doctor leave recorded successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to record leave', 400, error.errors);
    }
  }

  static async deleteDoctorLeave(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const doctorId = req.params.doctorId as string;
      const leaveId = req.params.leaveId as string;
      const result = await AdminService.deleteDoctorLeave(hospitalId, doctorId, leaveId, req.user?.id);
      return successResponse(res, result, 'Doctor leave deleted');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete leave', 400);
    }
  }

  static async getHospitalProfile(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const profile = await AdminService.getHospitalProfile(hospitalId);
      return successResponse(res, profile, 'Hospital profile retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hospital profile', 500);
    }
  }

  static async updateHospitalProfile(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const validated = updateHospitalSchema.parse(req.body);
      const updated = await AdminService.updateHospitalProfile(hospitalId, validated, req.user?.id);
      return successResponse(res, updated, 'Hospital profile updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update hospital profile', 400, error.errors);
    }
  }

  static async getNotifications(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this admin account', 400);
      }

      const notifications = await NotificationService.getHospitalNotifications(hospitalId);
      return successResponse(res, notifications, 'Notifications retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch notifications', 500);
    }
  }

  static async markNotificationRead(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await NotificationService.markAsRead(id);
      return successResponse(res, null, 'Notification marked as read');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update notification', 500);
    }
  }

  // -------------------------------------------------------------
  // OFFLINE APPOINTMENT BOOKING
  // -------------------------------------------------------------
  static async createOfflineAppointment(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated with this session', 400);

      const validated = createOfflineAppointmentSchema.parse({
        ...req.body,
        hospitalId,
      });

      const result = await AppointmentService.createOfflineAppointment({
        ...validated,
        requestingUserId: req.user?.id,
      });

      return successResponse(
        res,
        result,
        `Offline OP booking confirmed. Token #${result.appointment.tokenNumber}`,
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create offline booking', 400, error.errors);
    }
  }

  // -------------------------------------------------------------
  // DOCTOR ASSOCIATION & APPROVAL
  // -------------------------------------------------------------
  static async getPendingDoctors(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const pending = await AdminService.getPendingDoctors(hospitalId);
      return successResponse(res, pending, 'Pending doctor applications retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch pending doctors', 500);
    }
  }

  // -------------------------------------------------------------
  // HOSPITAL PATIENT RECORDS MANAGEMENT
  // -------------------------------------------------------------
  static async getPatients(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const { search, page, limit } = req.query;
      const result = await AdminService.getHospitalPatients(hospitalId, {
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return successResponse(res, result, 'Hospital patient records retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch patient records', 500);
    }
  }

  static async getPatientDetails(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const patientId = req.params.patientId as string;
      const patient = await AdminService.getPatientDetails(hospitalId, patientId);
      return successResponse(res, patient, 'Patient medical details retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch patient details', 404);
    }
  }

  // -------------------------------------------------------------
  // SUPPORT STAFF APPROVAL & MANAGEMENT
  // -------------------------------------------------------------
  static async getSupportStaff(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const staff = await AdminService.getSupportStaff(hospitalId);
      return successResponse(res, staff, 'Hospital support staff retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch support staff', 500);
    }
  }

  static async approveSupportStaff(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const staffId = req.params.id as string;
      const updated = await AdminService.updateSupportStaffStatus(hospitalId, staffId, 'APPROVED', req.user?.id);
      return successResponse(res, updated, 'Support staff member approved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to approve support staff', 400);
    }
  }

  static async rejectSupportStaff(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const staffId = req.params.id as string;
      const updated = await AdminService.updateSupportStaffStatus(hospitalId, staffId, 'REJECTED', req.user?.id);
      return successResponse(res, updated, 'Support staff member registration rejected');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reject support staff', 400);
    }
  }

  // -------------------------------------------------------------
  // HOSPITAL SUB-ADMIN MANAGEMENT
  // -------------------------------------------------------------
  static async createSubAdmin(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const validated = createSubAdminSchema.parse(req.body);
      const subAdmin = await AdminService.createSubAdmin(hospitalId, validated, req.user?.id);
      return successResponse(res, subAdmin, 'Sub-Administrator created successfully with customized permissions', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create sub-admin', 400, error.errors);
    }
  }

  static async getSubAdmins(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const subAdmins = await AdminService.getSubAdmins(hospitalId);
      return successResponse(res, subAdmins, 'Hospital sub-administrators retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch sub-admins', 500);
    }
  }

  static async updateSubAdminPermissions(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const subAdminId = req.params.id as string;
      const validated = updateSubAdminPermissionsSchema.parse(req.body);
      const updated = await AdminService.updateSubAdminPermissions(hospitalId, subAdminId, validated, req.user?.id);
      return successResponse(res, updated, 'Sub-admin permissions updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update sub-admin permissions', 400, error.errors);
    }
  }

  static async deleteSubAdmin(req: Request, res: Response) {
    try {
      const hospitalId = req.user?.hospitalId;
      if (!hospitalId) return errorResponse(res, 'Hospital not associated', 400);

      const subAdminId = req.params.id as string;
      await AdminService.deleteSubAdmin(hospitalId, subAdminId, req.user?.id);
      return successResponse(res, null, 'Sub-admin removed successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to remove sub-admin', 400);
    }
  }
}

