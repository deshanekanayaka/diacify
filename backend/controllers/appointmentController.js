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

// GET /api/appointments
const getAllAppointments = async (req, res) => {
  try {
    const { userId: clerk_id } = req.auth;

    const rows = await db.query(
      `SELECT a.appointment_id, a.patient_id, a.scheduled_date,
              a.appointment_type, a.notes, a.status
       FROM appointments a
       WHERE a.clerk_id = ?
       ORDER BY a.scheduled_date ASC`,
      [clerk_id]
    );

    const todayStr = new Date().toISOString().slice(0, 10);

    const formatRow = (row) => {
      const dateStr = row.scheduled_date instanceof Date
        ? row.scheduled_date.toISOString().slice(0, 10)
        : String(row.scheduled_date).slice(0, 10);
      return {
        appointment_id:   row.appointment_id,
        patient_id:       row.patient_id,
        scheduled_date:   dateStr,
        appointment_type: row.appointment_type,
        notes:            row.notes,
        status:           row.status,
      };
    };

    const upcoming = (rows || [])
      .filter(r => {
        const d = new Date(r.scheduled_date).toISOString().slice(0, 10);
        return r.status === 'scheduled' && d >= todayStr;
      })
      .map(formatRow);

    const past = (rows || [])
      .filter(r => {
        const d = new Date(r.scheduled_date).toISOString().slice(0, 10);
        return r.status !== 'scheduled' || d < todayStr;
      })
      .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
      .map(formatRow);

    res.json({ success: true, data: { upcoming, past } });

  } catch (error) {
    logger.error('Error fetching all appointments: ' + error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

// GET /api/appointments/upcoming
const getUpcomingAppointments = async (req, res) => {
  try {
    const { userId: clerk_id } = req.auth;

    const rows = await db.query(
      `SELECT appointment_id, patient_id, scheduled_date, appointment_type, notes
       FROM appointments
       WHERE clerk_id = ?
         AND status = 'scheduled'
         AND scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY scheduled_date ASC`,
      [clerk_id]
    );

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const data = (rows || []).map((row) => {
      const rowDate = row.scheduled_date instanceof Date
        ? row.scheduled_date.toISOString().slice(0, 10)
        : String(row.scheduled_date).slice(0, 10);
      return {
        appointment_id: row.appointment_id,
        patient_id: row.patient_id,
        scheduled_date: rowDate,
        appointment_type: row.appointment_type,
        notes: row.notes,
        is_overdue: rowDate < todayStr,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching upcoming appointments: ' + error.message + ' ' + error.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming appointments' });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { userId: clerk_id } = req.auth;
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['completed', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be completed or cancelled',
      });
    }

    // Verify appointment exists and belongs to this clinician
    const existing = await db.queryOne(
      'SELECT appointment_id, status FROM appointments WHERE appointment_id = ? AND clerk_id = ?',
      [id, clerk_id]
    );
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    if (existing.status === 'completed' && status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment',
      });
    }
    if (existing.status === 'cancelled' && status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a cancelled appointment',
      });
    }
    await db.execute(
      'UPDATE appointments SET status = ? WHERE appointment_id = ?',
      [status, id]
    );

    res.json({ success: true, data: { appointment_id: id, status } });

  } catch (error) {
    logger.error('Error updating appointment status: ' + error.message);
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
};

export {
  createAppointment,
  getAppointmentsByPatient,
  getUpcomingAppointments,
  getAllAppointments,
  updateAppointmentStatus,
};
