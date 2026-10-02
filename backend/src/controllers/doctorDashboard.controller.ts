import { Request, Response } from 'express';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { successResponse, errorResponse } from '../utils/response';
import {
  completeConsultationSchema,
  doctorLeaveSchema,
  doctorScheduleUpdateSchema,
  prescriptionTemplateSchema,
  createLabRequestSchema,
} from '../validators/schemas';

export class DoctorDashboardController {
  static async getAppointments(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) {
        return errorResponse(res, 'Doctor account not linked to this session', 400);
      }

      const { date } = req.query;
      const appointments = await DoctorDashboardService.getDoctorAppointments(doctorId, date as string);

      return successResponse(res, appointments, 'Doctor schedule and queue retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch appointments', 500);
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) {
        return errorResponse(res, 'Doctor account not linked to this session', 400);
      }

      const profile = await DoctorDashboardService.getDoctorProfile(doctorId);
      return successResponse(res, profile, 'Doctor profile retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch profile', 500);
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) {
        return errorResponse(res, 'Doctor account not linked to this session', 400);
      }

      const updated = await DoctorDashboardService.updateDoctorProfile(doctorId, req.body, req.user?.id);
      return successResponse(res, updated, 'Doctor profile updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update profile', 400);
    }
  }

  static async getSchedules(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const schedules = await DoctorDashboardService.getDoctorSchedules(doctorId);
      return successResponse(res, schedules, 'Doctor weekly schedules retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch schedules', 500);
    }
  }

  static async updateSchedules(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const validated = doctorScheduleUpdateSchema.parse(req.body);
      const schedules = await DoctorDashboardService.updateDoctorSchedules(doctorId, validated.schedules, req.user?.id);
      return successResponse(res, schedules, 'Schedules updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update schedules', 400, error.errors);
    }
  }

  static async getLeaves(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const leaves = await DoctorDashboardService.getDoctorLeaves(doctorId);
      return successResponse(res, leaves, 'Doctor leave records retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch leaves', 500);
    }
  }

  static async applyLeave(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const validated = doctorLeaveSchema.parse(req.body);
      const leave = await DoctorDashboardService.applyLeave(doctorId, validated, req.user?.id);
      return successResponse(res, leave, 'Leave applied successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to apply leave', 400, error.errors);
    }
  }

  static async cancelLeave(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const leaveId = req.params.leaveId as string;
      const result = await DoctorDashboardService.cancelLeave(doctorId, leaveId, req.user?.id);
      return successResponse(res, result, 'Leave cancelled');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to cancel leave', 400);
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const stats = await DoctorDashboardService.getDoctorStats(doctorId);
      return successResponse(res, stats, 'Doctor statistics retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch stats', 500);
    }
  }

  static async startConsultation(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) {
        return errorResponse(res, 'Doctor account not linked to this session', 400);
      }

      const appointmentId = req.params.appointmentId as string;
      const updated = await DoctorDashboardService.startConsultation(doctorId, appointmentId, req.user?.id);

      return successResponse(res, updated, 'Consultation started. Patient status set to IN_CONSULTATION');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to start consultation', 400);
    }
  }

  static async completeConsultation(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) {
        return errorResponse(res, 'Doctor account not linked to this session', 400);
      }

      const appointmentId = req.params.appointmentId as string;
      const validated = completeConsultationSchema.parse(req.body);

      const result = await DoctorDashboardService.completeConsultation(doctorId, appointmentId, validated, req.user?.id);

      return successResponse(
        res,
        result,
        'Consultation completed successfully. Prescription and medical records saved.'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to complete consultation', 400, error.errors);
    }
  }

  static async getPrescription(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const appointmentId = req.params.appointmentId as string;
      const prescription = await DoctorDashboardService.getPrescription(doctorId, appointmentId);
      return successResponse(res, prescription, 'Prescription details retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch prescription', 500);
    }
  }

  static async getConsultationDetails(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const appointmentId = req.params.appointmentId as string;
      const details = await DoctorDashboardService.getConsultationDetails(doctorId, appointmentId);
      return successResponse(res, details, 'Consultation workspace loaded with patient history and vitals');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch consultation details', 500);
    }
  }

  // -------------------------------------------------------------
  // PRESCRIPTION TEMPLATES
  // -------------------------------------------------------------
  static async getTemplates(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const search = req.query.search as string | undefined;
      const templates = await DoctorDashboardService.getPrescriptionTemplates(doctorId, search);
      return successResponse(res, templates, 'Prescription templates retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch templates', 500);
    }
  }

  static async bulkCreateTemplates(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const templates = req.body.templates || req.body;
      if (!Array.isArray(templates) || templates.length === 0) {
        return errorResponse(res, 'Invalid request. An array of templates is required.', 400);
      }

      const result = await DoctorDashboardService.bulkCreatePrescriptionTemplates(doctorId, templates, req.user?.id);
      return successResponse(res, result, `Successfully imported ${result.count} prescription templates`, 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to bulk import templates', 400);
    }
  }

  static async createTemplate(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const validated = prescriptionTemplateSchema.parse(req.body);
      const template = await DoctorDashboardService.createPrescriptionTemplate(doctorId, validated, req.user?.id);
      return successResponse(res, template, 'Prescription template saved', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to save template', 400, error.errors);
    }
  }

  static async updateTemplate(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const templateId = req.params.templateId as string;
      const validated = prescriptionTemplateSchema.partial().parse(req.body);
      const updated = await DoctorDashboardService.updatePrescriptionTemplate(doctorId, templateId, validated, req.user?.id);
      return successResponse(res, updated, 'Template updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update template', 400, error.errors);
    }
  }

  static async deleteTemplate(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const templateId = req.params.templateId as string;
      await DoctorDashboardService.deletePrescriptionTemplate(doctorId, templateId, req.user?.id);
      return successResponse(res, null, 'Template deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete template', 400);
    }
  }

  // -------------------------------------------------------------
  // LAB TEST REQUESTS
  // -------------------------------------------------------------
  static async createLabRequest(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const validated = createLabRequestSchema.parse(req.body);
      const request = await DoctorDashboardService.createLabTestRequest(doctorId, validated, req.user?.id);
      return successResponse(res, request, 'Diagnostic lab request sent successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to submit lab test request', 400, error.errors);
    }
  }

  static async getLabRequests(req: Request, res: Response) {
    try {
      const doctorId = req.user?.doctorId;
      if (!doctorId) return errorResponse(res, 'Doctor session required', 400);

      const requests = await DoctorDashboardService.getDoctorLabRequests(doctorId);
      return successResponse(res, requests, 'Laboratory test requests and reports retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch lab requests', 500);
    }
  }
}

