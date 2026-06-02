import axios from 'axios';
import * as db from '../config/database.js';
import { patientSchema, patientCreateSchema, checkWarnings } from '../utils/schema.js';
import logger from '../utils/logger.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// Valid risk levels — used to validate the riskLevel query parameter in getAllPatients
const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

// Flattens Zod's nested error structure into a flat array of readable strings
// e.g. ['age: Min 0', 'bp_systolic: Min 50']
const formatZodErrors = (zodError) =>
    zodError.errors.map((e) => `${e.path.join('.')}: ${e.message}`);

// Adding a required field to patientSchema automatically updates both field lists.
// Optional fields (e.g. genetics) are excluded so they are not flagged as missing.
const REQUIRED_UPDATE_FIELDS = Object.keys(patientSchema.shape).filter(
  (key) => !patientSchema.shape[key].isOptional()
);

// Checks which required fields are missing or empty in the request body
const getMissingFields = (body, fields) => {
  const missing = [];

  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }

  return missing;
};

// MySQL stores top_factors as a JSON string — converts it back to an array
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

    // Runs a manual presence check before Zod so missing fields get a clear error message
    const missingFields = getMissingFields(req.body, REQUIRED_UPDATE_FIELDS);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: missingFields.map((f) => `${f}: This field is required`),
      });
    }

    // Validates field types and clinical value ranges using the create schema
    const result = patientCreateSchema.safeParse(req.body);

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

    // Checks validated data against clinical warning thresholds.
    // Warnings are informational — they do not block the record from being saved.
    const warnings = checkWarnings(result.data);

    // Attempts to score the patient via ML; saves with pending status on any failure
    // so patient data is never lost due to ML unavailability.
    let risk_score = null;
    let risk_category = 'pending';
    let top_factors = [];
    let ml_pending = false;
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        age, sex, hba1c, bmi, bp_systolic, bp_diastolic, rbs,
        triglycerides, hdl, ldl, genetics: genetics ?? 0,
      }, {
        headers: { 'X-Internal-Secret': process.env.ML_INTERNAL_SECRET },
        timeout: 3000,
      });
      ({ risk_score, risk_category, top_factors } = mlResponse.data);
    } catch (mlError) {
      logger.warn('ML service unavailable — saving patient with pending risk status:', mlError.message);
      ml_pending = true;
    }

    // top_factors serialised to JSON string so MySQL can store it in the JSON column
    const top_factors_json = JSON.stringify(top_factors);

    const sql = `
            INSERT INTO patients
                (clerk_id, age, sex, social_life,
                 cholesterol, triglycerides, hdl, ldl, vldl,
                 bp_systolic, bp_diastolic, hba1c, bmi, rbs,
                 risk_score, risk_category, top_factors)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const values = [
      userId, age, sex, social_life,
      cholesterol, triglycerides, hdl, ldl, vldl,
      bp_systolic, bp_diastolic, hba1c, bmi, rbs,
      risk_score, risk_category, top_factors_json,
    ];

    const dbResult = await db.execute(sql, values);

    // Returns warnings alongside the patient data so the frontend can display
    // them to the clinician without blocking the successful save
    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      warnings,
      ...(ml_pending && { ml_pending: true }),
      data: { patient_id: dbResult.insertId, risk_score, risk_category, top_factors },
    });

  } catch (error) {
    logger.error('Error creating patient:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create patient' });
  }
};

// GET /api/patients
const getAllPatients = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { sortBy, riskLevel } = req.query;

    let sql = 'SELECT * FROM patients WHERE clerk_id = ?';
    const values = [userId];

    // Validates riskLevel against allowed values before appending to the query
    if (riskLevel && riskLevel !== 'all') {
      if (!VALID_RISK_LEVELS.includes(riskLevel)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid riskLevel. Must be low, medium, or high',
        });
      }
      sql += ' AND risk_category = ?';
      values.push(riskLevel);
    }

    // Defaults to newest-first order; switches to highest risk first when sortBy is "risk"
    sql += sortBy === 'risk' ? ' ORDER BY risk_score DESC' : ' ORDER BY patient_id DESC';

    const patients = await db.query(sql, values);

    // Parses top_factors from JSON string back to array for each patient
    const parsed = patients.map(parseTopFactors);

    res.status(200).json({ success: true, count: parsed.length, data: parsed });

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

    // Returns 404 rather than an empty object so the frontend can handle it unambiguously
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.status(200).json({ success: true, data: parseTopFactors(patient) });

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

    // Confirms the patient exists and belongs to this clinician before any validation or ML calls
    const existing = await db.queryOne(
        'SELECT * FROM patients WHERE patient_id = ? AND clerk_id = ?',
        [id, userId]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Runs the same manual presence check as createPatient before passing data to Zod
    const missingFields = getMissingFields(req.body, REQUIRED_UPDATE_FIELDS);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: missingFields.map((f) => `${f}: This field is required`),
      });
    }

    // Uses the base schema (without clerk_id) since the clinician cannot change after creation
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

    // Checks validated data against clinical warning thresholds
    const warnings = checkWarnings(result.data);

    // Re-scores the patient; saves with pending status on any failure so no data is lost.
    let risk_score = null;
    let risk_category = 'pending';
    let top_factors = [];
    let ml_pending = false;
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        age, sex, hba1c, bmi, bp_systolic, bp_diastolic, rbs,
        triglycerides, hdl, ldl, genetics: genetics ?? 0,
      }, {
        headers: { 'X-Internal-Secret': process.env.ML_INTERNAL_SECRET },
        timeout: 3000,
      });
      ({ risk_score, risk_category, top_factors } = mlResponse.data);
    } catch (mlError) {
      logger.warn('ML service unavailable — saving patient with pending risk status:', mlError.message);
      ml_pending = true;
    }

    // Extracts all three ML outputs including the refreshed top_factors for this patient
    const top_factors_json = JSON.stringify(top_factors);

    const sql = `
            UPDATE patients SET
                age=?, sex=?, social_life=?,
                cholesterol=?, triglycerides=?, hdl=?, ldl=?, vldl=?,
                bp_systolic=?, bp_diastolic=?,
                hba1c=?, bmi=?, rbs=?,
                risk_score=?, risk_category=?, top_factors=?
            WHERE patient_id=? AND clerk_id=?
        `;

    const values = [
      age, sex, social_life,
      cholesterol, triglycerides, hdl, ldl, vldl,
      bp_systolic, bp_diastolic,
      hba1c, bmi, rbs,
      risk_score, risk_category, top_factors_json,
      id, userId,
    ];

    await db.execute(sql, values);

    // Returns warnings alongside updated risk details so the frontend can display them
    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      warnings,
      ...(ml_pending && { ml_pending: true }),
      data: { patient_id: parseInt(id), risk_score, risk_category, top_factors },
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

    // Checks the patient exists and belongs to this clinician before deletion
    const existing = await db.queryOne(
        'SELECT * FROM patients WHERE patient_id = ? AND clerk_id = ?',
        [id, userId]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    await db.execute('DELETE FROM patients WHERE patient_id = ? AND clerk_id = ?', [id, userId]);

    res.status(200).json({ success: true, message: 'Patient deleted successfully' });

  } catch (error) {
    logger.error('Error deleting patient:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete patient' });
  }
};

export { createPatient, getAllPatients, getPatientById, updatePatient, deletePatient };