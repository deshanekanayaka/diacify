import * as db from '../config/database.js';
import logger from '../utils/logger.js';

// Mapping of display labels to DB values
const APPOINTMENT_TYPE_MAP = {
  'Routine Review': 'routine',
  'Urgent Attention': 'urgent',
  'Follow-up Visit': 'follow-up',
  'routine': 'routine',
  'urgent': 'urgent',
  'follow-up': 'follow-up',
};

// POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { userId: clerk_id } = req.auth;
    const { patient_id, scheduled_date, appointment_type, notes } = req.body;

    // Validate required fields
    if (!patient_id || !scheduled_date || !appointment_type) {
      return res.status(400).json({
        success: false,
        message: 'patient_id, scheduled_date, and appointment_type are required',
      });
    }

    // Validate scheduled_date is in the future
    const appointmentDate = new Date(scheduled_date);
    if (Number.isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'scheduled_date must be a valid date',
      });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (appointmentDate <= today) {
      return res.status(400).json({
        success: false,
        message: 'scheduled_date must be a future date',
      });
    }

    // Map appointment_type to DB value
    const dbAppointmentType = APPOINTMENT_TYPE_MAP[appointment_type];
    if (!dbAppointmentType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment_type',
      });
    }

    // Verify patient exists and belongs to this clerk
    const patientRow = await db.queryOne(
      'SELECT patient_id FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [patient_id, clerk_id]
    );

    if (!patientRow) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    // Insert appointment
    const result = await db.execute(
      'INSERT INTO appointments (patient_id, clerk_id, scheduled_date, appointment_type, notes, status, visit_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [patient_id, clerk_id, scheduled_date, dbAppointmentType, notes || null, 'scheduled', null]
    );

    res.status(201).json({
      success: true,
      data: {
        appointment_id: result.insertId,
        patient_id,
        clerk_id,
        scheduled_date,
        appointment_type: dbAppointmentType,
        notes: notes || null,
        status: 'scheduled',
      },
    });

  } catch (error) {
    logger.error('Error creating appointment: ' + error.message + ' ' + error.stack);
    res.status(500).json({ success: false, message: 'Failed to create appointment' });
  }
};

// GET /api/appointments/:patientId
const getAppointmentsByPatient = async (req, res) => {
  try {
    const { userId: clerk_id } = req.auth;
    const { patientId } = req.params;

    // Verify patient exists and belongs to this clerk
    const patientRow = await db.queryOne(
      'SELECT patient_id FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [patientId, clerk_id]
    );

    if (!patientRow) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    // Get all appointments for this patient, ordered by scheduled_date descending
    const appointments = await db.query(
      'SELECT * FROM appointments WHERE patient_id = ? ORDER BY scheduled_date DESC',
      [patientId]
    );

    res.status(200).json({
      success: true,
      data: appointments || [],
    });

  } catch (error) {
    logger.error('Error fetching appointments: ' + error.message + ' ' + error.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

export { createAppointment, getAppointmentsByPatient };
