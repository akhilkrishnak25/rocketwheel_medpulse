import { Router } from 'express';
import { HospitalController } from '../controllers/hospital.controller';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

router.get('/', HospitalController.listHospitals);
router.post('/register', AuthController.registerHospital);
router.get('/departments', HospitalController.listDepartments);
router.get('/:id', HospitalController.getHospital);
router.get('/:id/doctors', HospitalController.getHospitalDoctors);

export default router;
