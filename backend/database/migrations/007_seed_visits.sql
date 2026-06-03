USE diacify_db;

-- Migrates measurement data from diabetic_db.patients into
-- the new visits table. Each old patient row becomes one visit.

INSERT IGNORE INTO visits
  (patient_id, visit_date, age, bp_systolic, bp_diastolic,
   cholesterol, triglycerides, hdl, ldl, vldl,
   hba1c, bmi, rbs, risk_score, risk_category, top_factors,
   created_at)
SELECT
  CONCAT('PAT-', YEAR(p.created_at), '-', LPAD(p.patient_id, 4, '0')),
  DATE(p.created_at),
  p.age,
  p.bp_systolic,
  p.bp_diastolic,
  p.cholesterol,
  p.triglycerides,
  p.hdl,
  p.ldl,
  p.vldl,
  p.hba1c,
  p.bmi,
  p.rbs,
  p.risk_score,
  p.risk_category,
  p.top_factors,
  p.created_at
FROM diabetic_db.patients p;

-- Fix BP values migrated from diabetic_db that were stored in
-- dataset units (systolic < 30 means value was e.g. 12.0 = 120 mmHg)
-- Multiply by 10 to convert to real mmHg to match the new schema.
UPDATE visits
SET
  bp_systolic  = bp_systolic  * 10,
  bp_diastolic = bp_diastolic * 10
WHERE bp_systolic < 30;
