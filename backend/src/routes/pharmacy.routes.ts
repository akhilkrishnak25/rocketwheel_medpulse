import { Router } from 'express';
import { PharmacyController } from '../controllers/pharmacy.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect for PHARMACY_STAFF, HOSPITAL_ADMIN, or SUPER_ADMIN
router.use(authenticate, requireRole(['PHARMACY_STAFF', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'SUPER_ADMIN']));

router.get('/prescriptions', PharmacyController.getPrescriptions);
router.patch('/prescriptions/:prescriptionId/status', PharmacyController.updateStatus);

export default router;
