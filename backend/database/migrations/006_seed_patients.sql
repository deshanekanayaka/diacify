USE diacify_db;

-- Migrates identity data from diabetic_db.patients into
-- the new patients table. Generates PAT-YYYY-NNNN IDs
-- from the old auto-increment integer IDs.

INSERT IGNORE INTO patients
  (patient_id, clerk_id, sex, social_life, genetics, created_at)
SELECT
  CONCAT('PAT-', YEAR(created_at), '-', LPAD(patient_id, 4, '0')),
  clerk_id,
  sex,
  social_life,
  '0',
  created_at
FROM diabetic_db.patients;
