import { Router } from 'express';
import authRoutes from './auth.routes';
import hospitalRoutes from './hospital.routes';
import doctorRoutes from './doctor.routes';
import appointmentRoutes from './appointment.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import doctorDashboardRoutes from './doctorDashboard.routes';
import superAdminRoutes from './superAdmin.routes';
import otpRoutes from './otp.routes';
import supportStaffRoutes from './supportStaff.routes';
import labRoutes from './lab.routes';
import pharmacyRoutes from './pharmacy.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/doctor', doctorDashboardRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/otp', otpRoutes);
router.use('/support-staff', supportStaffRoutes);
router.use('/lab', labRoutes);
router.use('/pharmacy', pharmacyRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MediPulse Multi-Hospital Core API',
  });
});

// API Root Index
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Rocket Wheel MediPulse Multi-Hospital Core API',
    status: 'operational',
    version: '1.0.0',
    frontendUrl: 'http://localhost:5173',
    endpoints: {
      health: '/api/health',
      hospitals: '/api/hospitals',
      doctors: '/api/doctors',
      departments: '/api/hospitals/departments',
      appointments: '/api/appointments',
      auth: '/api/auth/login',
    },
  });
});

export default router;
