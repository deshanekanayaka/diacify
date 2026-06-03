import express from 'express';
import {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  createVisit,
} from '../controllers/patientController.js';

const router = express.Router();

router.get('/',    getAllPatients);
router.post('/',   createPatient);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.post('/:id/visits', createVisit);

export default router;
