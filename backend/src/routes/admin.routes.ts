import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate, hospitalAdminGuard } from '../middleware/auth';

const router = Router();

router.use(authenticate, hospitalAdminGuard);

// Hospital Metrics & Appointments
router.get('/metrics', AdminController.getMetrics);
router.get('/appointments', AdminController.getAppointments);
router.patch('/appointments/:id/status', AdminController.updateAppointmentStatus);

// Doctor Management & Onboarding
router.get('/doctors', AdminController.getDoctors);
router.post('/doctors', AdminController.addDoctor);
router.post('/doctors/bulk-import', AdminController.bulkImportDoctors);
router.patch('/doctors/:doctorId', AdminController.updateDoctor);
router.patch('/doctors/:doctorId/approve', AdminController.approveDoctor);
router.patch('/doctors/:doctorId/reject', AdminController.rejectDoctor);
router.patch('/doctors/:doctorId/status', AdminController.toggleDoctorStatus);

// Doctor Schedules & Leaves
router.get('/doctors/:doctorId/schedules', AdminController.getDoctorSchedules);
router.put('/doctors/:doctorId/schedules', AdminController.updateDoctorSchedules);
router.get('/doctors/:doctorId/leaves', AdminController.getDoctorLeaves);
router.post('/doctors/:doctorId/leaves', AdminController.addDoctorLeave);
router.delete('/doctors/:doctorId/leaves/:leaveId', AdminController.deleteDoctorLeave);

// Department Management
router.get('/departments', AdminController.getDepartments);
router.post('/departments', AdminController.addDepartment);

// Hospital Profile Management
router.get('/profile', AdminController.getHospitalProfile);
router.patch('/profile', AdminController.updateHospitalProfile);

// Offline OP Bookings
router.post('/appointments/offline', AdminController.createOfflineAppointment);

// Doctor Associations & Approvals
router.get('/doctors/pending', AdminController.getPendingDoctors);

// Hospital Patient Records Management
router.get('/patients', AdminController.getPatients);
router.get('/patients/:patientId', AdminController.getPatientDetails);

// Support Staff Management
router.get('/support-staff', AdminController.getSupportStaff);
router.patch('/support-staff/:id/approve', AdminController.approveSupportStaff);
router.patch('/support-staff/:id/reject', AdminController.rejectSupportStaff);

// Hospital Sub-Admin Management
router.get('/sub-admins', AdminController.getSubAdmins);
router.post('/sub-admins', AdminController.createSubAdmin);
router.patch('/sub-admins/:id/permissions', AdminController.updateSubAdminPermissions);
router.delete('/sub-admins/:id', AdminController.deleteSubAdmin);

// System Notifications
router.get('/notifications', AdminController.getNotifications);
router.patch('/notifications/:id/read', AdminController.markNotificationRead);

// Hospital Diagnostic Laboratories & Visibility
router.get('/labs', AdminController.getLabs);
router.patch('/labs/:labId/visibility', AdminController.updateLabVisibility);
router.patch('/labs/:labId', AdminController.updateLab);

export default router;
