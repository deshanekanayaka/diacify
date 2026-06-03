import axios from 'axios';
import * as db from '../config/database.js';
import { patientSchema, checkWarnings } from '../utils/schema.js';
import logger from '../utils/logger.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

const formatZodErrors = (zodError) => {
    const issues = zodError?.errors || zodError?.issues || [];
    return issues.map((e) => `${e.path.join('.')}: ${e.message}`);
};

const REQUIRED_UPDATE_FIELDS = Object.keys(patientSchema.shape).filter(
  (key) => !patientSchema.shape[key].isOptional()
);

const getMissingFields = (body, fields) => {
  const missing = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  return missing;
};

const parseTopFactors = (patient) => {
  if (typeof patient.top_factors === 'string') {
    patient.top_factors = JSON.parse(patient.top_factors);
  }
  return patient;
};

// POST /api/patients
const createPatient = async (req, res) => {
  try {
    const { userId } = req.auth;

    const missingFields = getMissingFields(req.body, REQUIRED_UPDATE_FIELDS);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: missingFields.map((f) => `${f}: This field is required`),
      });
    }

    const result = patientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(result.error),
      });
    }

    const {
      age, sex, social_life,
      bp_systolic, bp_diastolic,
      cholesterol, triglycerides, hdl, ldl, vldl,
      hba1c, bmi, rbs, genetics,
    } = result.data;

    const warnings = checkWarnings(result.data);

    const year = new Date().getFullYear();
    const countRow = await db.queryOne(
      'SELECT COUNT(*) as count FROM patients WHERE YEAR(created_at) = YEAR(CURDATE())'
    );
    const sequence = String(countRow.count + 1).padStart(4, '0');
    const patient_id = `PAT-${year}-${sequence}`;

    await db.execute(
      'INSERT INTO patients (patient_id, clerk_id, sex, social_life, genetics) VALUES (?, ?, ?, ?, ?)',
      [patient_id, userId, sex, social_life, genetics ?? 0]
    );

    let risk_score = null;
    let risk_category = 'pending';
    let top_factors = [];
    let confidence_low = null;
    let confidence_medium = null;
    let confidence_high = null;
    let low_confidence = false;
    let ml_pending = false;
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        age, sex, hba1c, bmi, bp_systolic, bp_diastolic, rbs,
        triglycerides, hdl, ldl, genetics: genetics ?? 0,
      }, {
        headers: { 'X-Internal-Secret': process.env.ML_INTERNAL_SECRET },
        timeout: 3000,
      });
      ({ risk_score, risk_category, top_factors,
         confidence_low, confidence_medium, confidence_high, low_confidence } = mlResponse.data);
    } catch (mlError) {
      logger.warn('ML service unavailable — saving patient with pending risk status:', mlError.message);
      ml_pending = true;
    }

    const top_factors_json = JSON.stringify(top_factors);

    const visitResult = await db.execute(
      `INSERT INTO visits
        (patient_id, visit_date, age, bp_systolic, bp_diastolic,
         cholesterol, triglycerides, hdl, ldl, vldl,
         hba1c, bmi, rbs, risk_score, risk_category, top_factors,
         confidence_low, confidence_medium, confidence_high, low_confidence)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, age, bp_systolic, bp_diastolic,
       cholesterol, triglycerides, hdl, ldl, vldl,
       hba1c, bmi, rbs, risk_score, risk_category, top_factors_json,
       confidence_low, confidence_medium, confidence_high, low_confidence]
    );

    await db.execute(
      'INSERT INTO audit_log (clerk_id, action, patient_id, changed_fields) VALUES (?, ?, ?, ?)',
      [userId, 'create', patient_id, JSON.stringify({ sex, social_life, genetics, age, hba1c })]
    );

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      warnings,
      ml_pending,
      data: {
        patient_id,
        visit_id: visitResult.insertId,
        risk_score,
        risk_category,
        top_factors,
      },
    });

  } catch (error) {
    logger.error('Error creating patient: ' + error.message + ' ' + error.stack);
    res.status(500).json({ success: false, message: 'Failed to create patient' });
  }
};

// GET /api/patients
const getAllPatients = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { sortBy, riskLevel } = req.query;

    if (riskLevel && riskLevel !== 'all') {
      if (!VALID_RISK_LEVELS.includes(riskLevel)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid riskLevel. Must be low, medium, or high',
        });
      }
    }

    // userId appears twice: once for the CTE WHERE clause, once for the outer WHERE clause
    const values = [userId];
    let outerWhere = 'WHERE p.clerk_id = ?';
    values.push(userId);

    if (riskLevel && riskLevel !== 'all') {
      outerWhere += ' AND l.risk_category = ?';
      values.push(riskLevel);
    }

    const orderClause = sortBy === 'date'
      ? 'ORDER BY l.visit_date DESC'
      : 'ORDER BY l.risk_score DESC';

    const sql = `
      WITH ranked_visits AS (
        SELECT v.*,
          ROW_NUMBER() OVER (
            PARTITION BY v.patient_id
            ORDER BY v.visit_date DESC
          ) AS rn
        FROM visits v
        INNER JOIN patients p ON v.patient_id = p.patient_id
        WHERE p.clerk_id = ?
      ),
      latest AS (
        SELECT * FROM ranked_visits WHERE rn = 1
      ),
      previous AS (
        SELECT * FROM ranked_visits WHERE rn = 2
      )
      SELECT
        p.patient_id, p.sex, p.social_life, p.genetics, p.created_at,
        l.visit_id, l.visit_date, l.age, l.hba1c, l.bmi,
        l.bp_systolic, l.bp_diastolic, l.rbs, l.cholesterol,
        l.triglycerides, l.hdl, l.ldl, l.vldl,
        l.risk_score, l.risk_category, l.top_factors,
        l.confidence_low, l.confidence_medium, l.confidence_high,
        l.low_confidence,
        prev.risk_category AS previous_risk_category
      FROM patients p
      INNER JOIN latest l ON p.patient_id = l.patient_id
      LEFT JOIN previous prev ON p.patient_id = prev.patient_id
      ${outerWhere}
      ${orderClause}
    `;

    const riskOrder = { low: 0, medium: 1, high: 2, pending: -1 };

    const rows = await db.query(sql, values);
    const patients = rows.map((row) => {
      parseTopFactors(row);

      let trend = 'stable';
      if (row.previous_risk_category) {
        const curr = riskOrder[row.risk_category] ?? -1;
        const prev = riskOrder[row.previous_risk_category] ?? -1;
        if (curr > prev) trend = 'worsening';
        else if (curr < prev) trend = 'improving';
      }

      return { ...row, trend };
    });

    res.status(200).json({ success: true, count: patients.length, data: patients });

  } catch (error) {
    logger.error('Error fetching patients:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch patients' });
  }
};

// GET /api/patients/:id
const getPatientById = async (req, res) => {
  try {
    const { userId } = req.auth;

    const patient = await db.queryOne(
      'SELECT * FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [req.params.id, userId]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const visits = await db.query(
      'SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC',
      [req.params.id]
    );

    visits.forEach(parseTopFactors);

    res.status(200).json({
      success: true,
      data: {
        patient,
        visits,
        latest_visit: visits[0] || null,
      },
    });

  } catch (error) {
    logger.error('Error fetching patient:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch patient' });
  }
};

// PUT /api/patients/:id
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.auth;

    const existing = await db.queryOne(
      'SELECT * FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [id, userId]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const missingFields = getMissingFields(req.body, REQUIRED_UPDATE_FIELDS);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: missingFields.map((f) => `${f}: This field is required`),
      });
    }

    const result = patientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(result.error),
      });
    }

    const {
      age, sex, social_life,
      bp_systolic, bp_diastolic,
      cholesterol, triglycerides, hdl, ldl, vldl,
      hba1c, bmi, rbs, genetics,
    } = result.data;

    const warnings = checkWarnings(result.data);

    const identityChanged =
      sex !== existing.sex ||
      social_life !== existing.social_life ||
      (genetics ?? 0) !== Number(existing.genetics);

    if (identityChanged) {
      await db.execute(
        'UPDATE patients SET sex=?, social_life=?, genetics=? WHERE patient_id=? AND clerk_id=?',
        [sex, social_life, genetics ?? 0, id, userId]
      );
    }

    let risk_score = null;
    let risk_category = 'pending';
    let top_factors = [];
    let confidence_low = null;
    let confidence_medium = null;
    let confidence_high = null;
    let low_confidence = false;
    let ml_pending = false;
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        age, sex, hba1c, bmi, bp_systolic, bp_diastolic, rbs,
        triglycerides, hdl, ldl, genetics: genetics ?? 0,
      }, {
        headers: { 'X-Internal-Secret': process.env.ML_INTERNAL_SECRET },
        timeout: 3000,
      });
      ({ risk_score, risk_category, top_factors,
         confidence_low, confidence_medium, confidence_high, low_confidence } = mlResponse.data);
    } catch (mlError) {
      logger.warn('ML service unavailable — saving patient with pending risk status:', mlError.message);
      ml_pending = true;
    }

    const top_factors_json = JSON.stringify(top_factors);

    const visitResult = await db.execute(
      `INSERT INTO visits
        (patient_id, visit_date, age, bp_systolic, bp_diastolic,
         cholesterol, triglycerides, hdl, ldl, vldl,
         hba1c, bmi, rbs, risk_score, risk_category, top_factors,
         confidence_low, confidence_medium, confidence_high, low_confidence)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, age, bp_systolic, bp_diastolic,
       cholesterol, triglycerides, hdl, ldl, vldl,
       hba1c, bmi, rbs, risk_score, risk_category, top_factors_json,
       confidence_low, confidence_medium, confidence_high, low_confidence]
    );

    await db.execute(
      'INSERT INTO audit_log (clerk_id, action, patient_id, changed_fields) VALUES (?, ?, ?, ?)',
      [userId, 'update', id, JSON.stringify({ age, hba1c, bmi, bp_systolic, bp_diastolic, rbs })]
    );

    res.status(200).json({
      success: true,
      message: 'Visit added successfully',
      warnings,
      ml_pending,
      data: {
        patient_id: id,
        visit_id: visitResult.insertId,
        risk_score,
        risk_category,
      },
    });

  } catch (error) {
    logger.error('Error updating patient:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update patient' });
  }
};

// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.auth;

    const existing = await db.queryOne(
      'SELECT * FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [id, userId]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    await db.execute(
      'DELETE FROM patients WHERE patient_id = ? AND clerk_id = ?',
      [id, userId]
    );

    await db.execute(
      'INSERT INTO audit_log (clerk_id, action, patient_id, changed_fields) VALUES (?, ?, ?, ?)',
      [userId, 'delete', id, JSON.stringify({ deleted_patient_id: id })]
    );

    res.status(200).json({ success: true, message: 'Patient deleted successfully' });

  } catch (error) {
    logger.error('Error deleting patient:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete patient' });
  }
};

export { createPatient, getAllPatients, getPatientById, updatePatient, deletePatient };
