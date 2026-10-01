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
}
