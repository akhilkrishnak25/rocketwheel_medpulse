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
  // BULK IMPORT & EXPORT OF LAB TESTS (MASTER CATALOG)
  // -------------------------------------------------------------
  static async downloadSampleTemplate(req: Request, res: Response) {
    try {
      const format = (req.query.format as string) === 'csv' ? 'csv' : 'xlsx';
      const file = await LabService.generateSampleTemplate(format);

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.send(file.buffer);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate sample template', 500);
    }
  }

  static async previewImportTests(req: Request, res: Response) {
    try {
      const labId = await LabService.resolveLabForUser(req.user);
      const { fileData, fileName, rows: directRows } = req.body;

      let rowsToValidate: any[] = [];

      if (Array.isArray(directRows) && directRows.length > 0) {
        rowsToValidate = directRows;
      } else if (fileData) {
        let base64Content = fileData;
        if (typeof fileData === 'string' && fileData.startsWith('data:')) {
          const parts = fileData.split(',');
          base64Content = parts[1] || parts[0];
        }
        const buffer = Buffer.from(base64Content, 'base64');
        rowsToValidate = await LabService.parseUploadedLabTestFile(buffer, fileName || 'upload.xlsx');
      } else {
        return errorResponse(res, 'File data or rows array is required for preview', 400);
      }

      if (rowsToValidate.length === 0) {
        return errorResponse(res, 'No data rows found in the uploaded file.', 400);
      }

      const preview = await LabService.validateAndPreviewImport(labId, rowsToValidate);
      return successResponse(res, preview, 'Lab test import preview generated');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to validate lab tests', 400);
    }
  }

  static async importTests(req: Request, res: Response) {
    try {
      const labId = await LabService.resolveLabForUser(req.user);
      const { tests } = req.body;

      if (!Array.isArray(tests) || tests.length === 0) {
        return errorResponse(res, 'Please provide an array of validated tests to import', 400);
      }

      const result = await LabService.importLabTests(labId, tests, req.user?.id);
      return successResponse(res, result, `Successfully imported ${result.importedCount} lab test(s) into catalog`, 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to import lab tests', 400);
    }
  }

  static async exportTests(req: Request, res: Response) {
    try {
      const labId = await LabService.resolveLabForUser(req.user);
      const format = (req.query.format as string) === 'csv' ? 'csv' : 'xlsx';
      const category = req.query.category as string | undefined;
      const department = req.query.department as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      let testIds: string[] | undefined;

      if (req.query.testIds) {
        if (Array.isArray(req.query.testIds)) {
          testIds = req.query.testIds as string[];
        } else if (typeof req.query.testIds === 'string') {
          testIds = (req.query.testIds as string).split(',').map((id) => id.trim()).filter(Boolean);
        }
      }

      const file = await LabService.exportLabTests(
        labId,
        { category, department, status, search, testIds },
        format
      );

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.send(file.buffer);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to export lab tests', 500);
    }
  }

  // -------------------------------------------------------------
  // PUBLIC & CUSTOMER-FACING ENDPOINTS
  // -------------------------------------------------------------
  static async getActiveLabs(req: Request, res: Response) {
    try {
      const { hospitalId, publicOnly } = req.query;
      const isHospitalStaff = req.user && ['DOCTOR', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
      const isPublic = publicOnly === 'true' || !isHospitalStaff;
      const targetHospitalId = (hospitalId as string) || (isHospitalStaff ? req.user?.hospitalId : undefined);
      const labs = await LabService.getActiveLabs(targetHospitalId, isPublic, req.user?.hospitalId);
      return successResponse(res, labs, 'Active laboratories retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch laboratories', 500);
    }
  }

  static async getPublicTests(req: Request, res: Response) {
    try {
      const { labId, category, search } = req.query;
      const isHospitalStaff = req.user && ['DOCTOR', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
      const tests = await LabService.getPublicLabTests(
        labId as string,
        category as string,
        search as string,
        isHospitalStaff ? req.user?.hospitalId : undefined
      );
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
