import { Request, Response } from 'express';
import { LabService } from '../services/lab.service';
import { successResponse, errorResponse } from '../utils/response';
import { submitLabReportSchema } from '../validators/schemas';

export class LabController {
  // -------------------------------------------------------------
  // REQUISITIONS MANAGEMENT (TECHNICIAN / HOSPITAL ADMIN)
  // -------------------------------------------------------------
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
      if (!status) {
        return errorResponse(res, 'Status is required', 400);
      }

      const updated = await LabService.updateRequestStatus(labId, requestId, status, req.user?.id);
      return successResponse(res, updated, `Test request status set to ${updated.status}`);
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

  // -------------------------------------------------------------
  // LAB TEST CATALOG & PRICE MANAGEMENT (TECHNICIAN)
  // -------------------------------------------------------------
  static async getTests(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const { category, search } = req.query;
      const tests = await LabService.getLabTests(labId, category as string, search as string);
      return successResponse(res, tests, 'Laboratory test catalog retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch lab tests', 500);
    }
  }

  static async createTest(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const { code, testCode, name, testName, category, description, tatHours, price, status } = req.body;
      const finalName = (name || testName || '').trim();
      const finalCode = (code || testCode || '').trim();
      if (!finalName || price === undefined) {
        return errorResponse(res, 'Test name and price are required.', 400);
      }

      const test = await LabService.createLabTest(
        labId,
        {
          code: finalCode,
          name: finalName,
          category: category || 'General Pathology',
          description,
          tatHours: tatHours ? Number(tatHours) : 24,
          price: Number(price),
          status: status || 'ACTIVE',
        },
        req.user?.id
      );

      return successResponse(res, test, 'Diagnostic test created in catalog', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create lab test', 400);
    }
  }

  static async updateTest(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const testId = req.params.testId as string;
      const { code, testCode, name, testName, category, description, tatHours, price, status } = req.body;

      const updated = await LabService.updateLabTest(
        labId,
        testId,
        {
          code: code || testCode,
          name: name || testName,
          category,
          description,
          tatHours: tatHours !== undefined ? Number(tatHours) : undefined,
          price: price !== undefined ? Number(price) : undefined,
          status,
        },
        req.user?.id
      );
      return successResponse(res, updated, 'Diagnostic test updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update lab test', 400);
    }
  }

  static async toggleTest(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const testId = req.params.testId as string;
      const updated = await LabService.toggleLabTestStatus(labId, testId, req.user?.id);
      return successResponse(res, updated, `Test marked as ${updated.status === 'ACTIVE' ? 'Available' : 'Unavailable'}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle test status', 400);
    }
  }

  static async deleteTest(req: Request, res: Response) {
    try {
      const labId = req.user?.labId;
      if (!labId) return errorResponse(res, 'Laboratory session required', 400);

      const testId = req.params.testId as string;
      const result = await LabService.deleteLabTest(labId, testId, req.user?.id);
      return successResponse(res, result, 'Test deleted from catalog');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete test', 400);
    }
  }

  // -------------------------------------------------------------
  // PUBLIC & CUSTOMER-FACING ENDPOINTS
  // -------------------------------------------------------------
  static async getActiveLabs(req: Request, res: Response) {
    try {
      const { hospitalId, publicOnly } = req.query;
      const isPublic = publicOnly === 'true' || !req.user || req.user.role === 'PATIENT';
      const labs = await LabService.getActiveLabs(hospitalId as string, isPublic);
      return successResponse(res, labs, 'Active laboratories retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch laboratories', 500);
    }
  }

  static async getPublicTests(req: Request, res: Response) {
    try {
      const { labId, category, search } = req.query;
      const tests = await LabService.getPublicLabTests(labId as string, category as string, search as string);
      return successResponse(res, tests, 'Available lab tests retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch lab tests', 500);
    }
  }

  static async bookTest(req: Request, res: Response) {
    try {
      const result = await LabService.bookCustomerLabTest(req.body);
      return successResponse(res, result, 'Laboratory test booked successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to book lab test', 400);
    }
  }

  static async getBookingStatus(req: Request, res: Response) {
    try {
      const idOrNum = (req.params.idOrNumber || req.query.query) as string;
      if (!idOrNum) return errorResponse(res, 'Booking reference number is required', 400);

      const booking = await LabService.getBookingStatus(idOrNum);
      return successResponse(res, booking, 'Requisition status retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Booking not found', 404);
    }
  }
}
