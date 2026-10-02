import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';

const router = Router();

// Publicly accessible lab endpoints
router.get('/active', LabController.getActiveLabs);
router.get('/tests', LabController.getPublicTests);
router.post('/book', LabController.bookTest);
router.get('/booking/:idOrNumber', LabController.getBookingStatus);

export default router;
