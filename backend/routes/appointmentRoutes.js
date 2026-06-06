import express from 'express';
import {
  createAppointment,
  getAllAppointments,
  getAppointmentsByPatient,
  getUpcomingAppointments,
  updateAppointmentStatus,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/',           createAppointment);
router.get('/',            getAllAppointments);
router.get('/upcoming',    getUpcomingAppointments);
router.patch('/:id/status',    updateAppointmentStatus);
router.get('/:patientId',  getAppointmentsByPatient);

export default router;
