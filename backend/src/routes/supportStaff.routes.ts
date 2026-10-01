import { Router } from 'express';
import { SupportStaffController } from '../controllers/supportStaff.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Only authenticated SUPPORT_STAFF, HOSPITAL_ADMIN, or SUPER_ADMIN
router.use(authenticate, requireRole(['SUPPORT_STAFF', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'SUPER_ADMIN']));

router.get('/queue', SupportStaffController.getQueue);
router.post('/vitals', SupportStaffController.recordVitals);
router.get('/vitals/:appointmentId', SupportStaffController.getVitals);

export default router;
