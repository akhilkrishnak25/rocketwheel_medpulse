import { Request, Response } from 'express';
import { LabService } from '../services/lab.service';
import { successResponse, errorResponse } from '../utils/response';
import { submitLabReportSchema } from '../validators/schemas';

export class LabController {
  static async getRequests(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) {
        return errorResponse(res, 'Laboratory affiliation missing from session', 400);
      }

      const { status } = req.query;
      const requests = await LabService.getTestRequests(labId, status as string);
      return successResponse(res, requests, 'Diagnostic test requests retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch test requests', 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const requestId = req.params.requestId as string;
      const { status } = req.body;
      if (!['ACCEPTED', 'PROCESSING', 'CANCELLED'].includes(status)) {
        return errorResponse(res, 'Invalid status update', 400);
      }

      const updated = await LabService.updateRequestStatus(labId, requestId, status, req.user?.id);
      return successResponse(res, updated, `Test request status set to ${status}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update request status', 400);
    }
  }

  static async submitReport(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const requestId = req.params.requestId as string;
      const validated = submitLabReportSchema.parse(req.body);

      const report = await LabService.submitReport(
        labId,
        requestId,
        validated,
        req.user?.id || 'tech',
        req.user?.email || 'Lab Technician'
      );

      return successResponse(res, report, 'Diagnostic report submitted and completed successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to submit lab report', 400, error.errors);
    }
  }
}
