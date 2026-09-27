import { Router } from 'express';
import { SuperAdminController } from '../controllers/superAdmin.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect all Super Admin routes
router.use(authenticate, requireRole(['SUPER_ADMIN']));

// Analytics & Overview
router.get('/metrics', SuperAdminController.getMetrics);
router.get('/audit-logs', SuperAdminController.getAuditLogs);
router.get('/users', SuperAdminController.getAllUsers);

// Hospital Management & Approvals
router.get('/pending-hospitals', SuperAdminController.getPendingHospitals);
router.get('/hospitals', SuperAdminController.getHospitals);
router.post('/hospitals', SuperAdminController.createHospital);
router.get('/hospitals/:id', SuperAdminController.getHospitalById);
router.patch('/hospitals/:id', SuperAdminController.updateHospital);
router.delete('/hospitals/:id', SuperAdminController.deleteHospital);
router.post('/hospitals/:id/approve', SuperAdminController.approveHospital);
router.post('/hospitals/:id/reject', SuperAdminController.rejectHospital);
router.patch('/hospitals/:id/status', SuperAdminController.toggleHospitalStatus);
router.post('/hospitals/:id/admin', SuperAdminController.createHospitalAdmin);

// Platform Doctor & Appointment Oversight
router.get('/doctors', SuperAdminController.getAllDoctors);
router.get('/appointments', SuperAdminController.getAllAppointments);

export default router;
