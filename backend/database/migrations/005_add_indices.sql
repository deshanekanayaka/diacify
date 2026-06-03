USE diacify_db;

-- visits: patient lookup
CREATE INDEX idx_visits_patient_id
  ON visits(patient_id);

-- visits: latest visit per patient (used by priority list query)
CREATE INDEX idx_visits_patient_date
  ON visits(patient_id, visit_date DESC);

-- appointments: clinician schedule lookup
CREATE INDEX idx_appointments_clerk
  ON appointments(clerk_id, scheduled_date);

-- audit_log: patient history lookup
CREATE INDEX idx_audit_patient
  ON audit_log(patient_id);
