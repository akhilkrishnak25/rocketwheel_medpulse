import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect for LAB_TECHNICIAN, HOSPITAL_ADMIN, or SUPER_ADMIN
router.use(authenticate, requireRole(['LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']));

// Requisitions & Reports
router.get('/requests', LabController.getRequests);
router.patch('/requests/:requestId/status', LabController.updateStatus);
router.post('/requests/:requestId/report', LabController.submitReport);

// Test Catalog & Price Management (CRUD)
router.get('/tests', LabController.getTests);
router.post('/tests', LabController.createTest);
router.patch('/tests/:testId', LabController.updateTest);
router.patch('/tests/:testId/toggle', LabController.toggleTest);
router.delete('/tests/:testId', LabController.deleteTest);

export default router;
