import { Router } from 'express';
import { PharmacyController } from '../controllers/pharmacy.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect for PHARMACY_STAFF, HOSPITAL_ADMIN, HOSPITAL_SUB_ADMIN, SUPER_ADMIN, DOCTOR
router.use(authenticate, requireRole(['PHARMACY_STAFF', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'SUPER_ADMIN', 'DOCTOR']));

router.get('/prescriptions', PharmacyController.getPrescriptions);
router.patch('/prescriptions/:prescriptionId/status', PharmacyController.updateStatus);
router.patch('/prescriptions/:prescriptionId/replace-medicine', PharmacyController.replaceMedicine);
router.get('/prescriptions/:prescriptionId/pdf', PharmacyController.downloadPrescriptionPdf);

export default router;
