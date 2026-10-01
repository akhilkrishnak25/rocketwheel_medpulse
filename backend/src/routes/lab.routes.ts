import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect for LAB_TECHNICIAN, HOSPITAL_ADMIN, or SUPER_ADMIN
router.use(authenticate, requireRole(['LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']));

router.get('/requests', LabController.getRequests);
router.patch('/requests/:requestId/status', LabController.updateStatus);
router.post('/requests/:requestId/report', LabController.submitReport);

export default router;
