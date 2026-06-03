USE diacify_db;

CREATE TABLE IF NOT EXISTS visits (
  visit_id          INT PRIMARY KEY AUTO_INCREMENT,
  patient_id        VARCHAR(20) NOT NULL,
  visit_date        DATE NOT NULL,
  age               INT NOT NULL,
  bp_systolic       DECIMAL(5,1) NOT NULL,
  bp_diastolic      DECIMAL(5,1) NOT NULL,
  cholesterol       DECIMAL(6,2),
  triglycerides     DECIMAL(6,2),
  hdl               DECIMAL(6,2),
  ldl               DECIMAL(6,2),
  vldl              DECIMAL(6,2),
  hba1c             DECIMAL(4,2) NOT NULL,
  bmi               DECIMAL(5,2) NOT NULL,
  rbs               DECIMAL(6,2),
  risk_score        DECIMAL(5,2),
  risk_category     VARCHAR(10) DEFAULT 'pending',
  top_factors       JSON,
  confidence_low    DECIMAL(5,2),
  confidence_medium DECIMAL(5,2),
  confidence_high   DECIMAL(5,2),
  low_confidence    BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);
