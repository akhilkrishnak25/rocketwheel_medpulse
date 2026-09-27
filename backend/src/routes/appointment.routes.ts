import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';

const router = Router();

// Guest Patient Booking Flow (No Login Required)
router.post('/', AppointmentController.createAppointment);
router.post('/confirm-payment', AppointmentController.confirmPayment);
router.get('/:id', AppointmentController.getAppointment);
router.get('/:id/queue', AppointmentController.getQueueStatus);
router.get('/:id/pdf', AppointmentController.downloadPdf);
router.get('/:id/prescription', AppointmentController.getPrescription);
router.post('/:id/cancel', AppointmentController.cancelAppointment);
router.get('/verify-op/:token', AppointmentController.verifyOpToken);

export default router;
