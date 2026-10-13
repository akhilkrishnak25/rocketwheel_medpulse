import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Publicly accessible lab endpoints (with optional authentication to allow doctors/staff to see hospital-private labs)
router.get('/active', optionalAuthenticate, LabController.getActiveLabs);
router.get('/tests', optionalAuthenticate, LabController.getPublicTests);
router.post('/book', LabController.bookTest);
router.get('/booking/:idOrNumber', LabController.getBookingStatus);

export default router;
