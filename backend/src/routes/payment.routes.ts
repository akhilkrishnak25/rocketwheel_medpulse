import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();

router.post('/create-order', PaymentController.createOrder);
router.post('/webhook', PaymentController.handleWebhook);

export default router;
