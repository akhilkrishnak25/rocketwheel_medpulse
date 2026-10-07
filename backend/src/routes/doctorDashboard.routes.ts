import { Router } from 'express';
import { DoctorDashboardController } from '../controllers/doctorDashboard.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protect all Doctor portal routes
router.use(authenticate, requireRole(['DOCTOR']));

// Queue & Appointments
router.get('/appointments', DoctorDashboardController.getAppointments);
router.get('/appointments/:appointmentId/consultation', DoctorDashboardController.getConsultationDetails);
router.get('/appointments/:appointmentId/pdf', DoctorDashboardController.downloadConsultationPdf);
router.post('/appointments/:appointmentId/start', DoctorDashboardController.startConsultation);
router.post('/appointments/:appointmentId/complete', DoctorDashboardController.completeConsultation);
router.get('/appointments/:appointmentId/prescription', DoctorDashboardController.getPrescription);

// Prescription Templates
router.get('/templates', DoctorDashboardController.getTemplates);
router.post('/templates', DoctorDashboardController.createTemplate);
router.post('/templates/bulk', DoctorDashboardController.bulkCreateTemplates);
router.patch('/templates/:templateId', DoctorDashboardController.updateTemplate);
router.delete('/templates/:templateId', DoctorDashboardController.deleteTemplate);

// Lab Requests
router.post('/lab-requests', DoctorDashboardController.createLabRequest);
router.get('/lab-requests', DoctorDashboardController.getLabRequests);

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

// Hospital Support Staff Assignment
router.get('/support-staff', DoctorDashboardController.getHospitalSupportStaff);
router.patch('/assigned-staff', DoctorDashboardController.updateAssignedStaff);

export default router;
