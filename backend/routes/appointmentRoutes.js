import express from 'express';
import {
  createAppointment,
  getAppointmentsByPatient,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/',           createAppointment);
router.get('/:patientId',  getAppointmentsByPatient);

export default router;
