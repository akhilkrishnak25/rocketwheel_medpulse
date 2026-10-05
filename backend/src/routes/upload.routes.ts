import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// PDF Report upload for lab technicians & doctors
router.post('/report', authenticate, UploadController.uploadReportPdf);

// Profile photo upload & removal for authenticated users (Doctor, Hospital Admin, etc.)
router.post('/profile-photo', authenticate, UploadController.uploadProfilePhoto);
router.delete('/profile-photo', authenticate, UploadController.removeProfilePhoto);

export default router;
