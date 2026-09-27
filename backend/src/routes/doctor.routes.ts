import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';

const router = Router();

// Public doctor discovery
router.get('/', DoctorController.listDoctors);
router.get('/:id', DoctorController.getDoctor);
router.get('/:id/availability', DoctorController.getDoctorSlots);

export default router;
