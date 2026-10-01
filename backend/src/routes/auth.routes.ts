import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);
router.get('/me', authenticate, AuthController.me);

// Password recovery and token activation
router.post('/forgot-password', AuthController.forgotPassword);
router.get('/verify-token', AuthController.verifyToken);
router.post('/reset-password', AuthController.resetPassword);
router.post('/activate', AuthController.activateAccount);

// Public registrations
router.post('/register-hospital', AuthController.registerHospital);
router.post('/register-doctor', AuthController.registerDoctor);
router.post('/register-lab', AuthController.registerLab);
router.post('/register-support-staff', AuthController.registerSupportStaff);
router.post('/register-pharmacy', AuthController.registerPharmacy);

export default router;
