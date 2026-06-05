import express from 'express';
import {
  createAppointment,
  getAppointmentsByPatient,
  getUpcomingAppointments,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/',           createAppointment);
router.get('/upcoming',    getUpcomingAppointments);
router.get('/:patientId',  getAppointmentsByPatient);

export default router;
