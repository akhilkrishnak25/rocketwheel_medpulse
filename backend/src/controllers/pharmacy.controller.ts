import { Request, Response } from 'express';
import { PharmacyService } from '../services/pharmacy.service';
import { successResponse, errorResponse } from '../utils/response';

export class PharmacyController {
  static async getPrescriptions(req: Request, res: Response) {
    try {
      const pharmacyId = req.user?.pharmacyId;
      const hospitalId = req.user?.hospitalId;

      if (!pharmacyId && !hospitalId && req.user?.role !== 'SUPER_ADMIN') {
        return errorResponse(res, 'Pharmacy or hospital affiliation required', 400);
      }

      const { status } = req.query;
      const prescriptions = await PharmacyService.getPrescriptions(pharmacyId, hospitalId, status as string);
      return successResponse(res, prescriptions, 'Pharmacy prescription orders retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch prescriptions', 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const pharmacyId = req.user?.pharmacyId;
      const prescriptionId = req.params.prescriptionId as string;
      const { status } = req.body;

      if (!['ACCEPTED', 'PROCESSING', 'COMPLETED'].includes(status)) {
        return errorResponse(res, 'Invalid prescription status update', 400);
      }

      const updated = await PharmacyService.updateStatus(
        prescriptionId,
        pharmacyId,
        status,
        req.user?.id || 'pharmacy-staff',
        req.user?.email || 'Pharmacy Staff'
      );

      return successResponse(res, updated, `Prescription order status updated to ${status}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update prescription status', 400);
    }
  }

  static async replaceMedicine(req: Request, res: Response) {
    try {
      const pharmacyId = req.user?.pharmacyId;
      const prescriptionId = req.params.prescriptionId as string;
      const { medicineIndex, originalName, replacement, reason, doctorApproved } = req.body;

      if (medicineIndex === undefined || !replacement?.name || !reason) {
        return errorResponse(
          res,
          'Medicine index, replacement medicine name, and substitution reason are required',
          400
        );
      }

      const updated = await PharmacyService.replaceMedicine(
        prescriptionId,
        pharmacyId,
        {
          medicineIndex: Number(medicineIndex),
          originalName,
          replacement,
          reason,
          doctorApproved,
        },
        req.user?.userId || req.user?.id || 'pharmacy-staff',
        req.user?.email || 'Pharmacy Staff'
      );

      return successResponse(res, updated, 'Unavailable medicine substituted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to substitute medicine', 400);
    }
  }

  static async downloadPrescriptionPdf(req: Request, res: Response) {
    try {
      const prescriptionId = req.params.prescriptionId as string;
      const pdfBuffer = await PharmacyService.generatePrescriptionPdf(prescriptionId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Revised-Prescription-${prescriptionId.slice(0, 8)}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate revised prescription PDF', 500);
    }
  }
}
