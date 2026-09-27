import { Router } from 'express';
import { DoctorDashboardController } from '../controllers/doctorDashboard.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect all Doctor portal routes
router.use(authenticate, requireRole(['DOCTOR']));

// Queue & Appointments
router.get('/appointments', DoctorDashboardController.getAppointments);
router.post('/appointments/:appointmentId/start', DoctorDashboardController.startConsultation);
router.post('/appointments/:appointmentId/complete', DoctorDashboardController.completeConsultation);
router.get('/appointments/:appointmentId/prescription', DoctorDashboardController.getPrescription);

// Doctor Profile & Analytics
router.get('/profile', DoctorDashboardController.getProfile);
router.patch('/profile', DoctorDashboardController.updateProfile);
router.get('/stats', DoctorDashboardController.getStats);

// Weekly Schedules & Leaves
router.get('/schedules', DoctorDashboardController.getSchedules);
router.put('/schedules', DoctorDashboardController.updateSchedules);
router.get('/leaves', DoctorDashboardController.getLeaves);
router.post('/leaves', DoctorDashboardController.applyLeave);
router.delete('/leaves/:leaveId', DoctorDashboardController.cancelLeave);

export default router;
