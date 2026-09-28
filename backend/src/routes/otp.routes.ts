import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OtpController } from '../controllers/otp.controller';

const router = Router();
const otpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 8,
	message: { success: false, message: 'Too many OTP requests. Please try again later.' },
	standardHeaders: true,
	legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, OtpController.sendOtp);
router.post('/verify-otp', otpLimiter, OtpController.verifyOtp);

export default router;
