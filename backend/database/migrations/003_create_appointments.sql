USE diacify_db;

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id   INT PRIMARY KEY AUTO_INCREMENT,
  patient_id       VARCHAR(20) NOT NULL,
  clerk_id         VARCHAR(100) NOT NULL,
  scheduled_date   DATE NOT NULL,
  appointment_type VARCHAR(20) NOT NULL,
  notes            TEXT,
  status           VARCHAR(20) DEFAULT 'scheduled',
  visit_id         INT DEFAULT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE SET NULL
);
