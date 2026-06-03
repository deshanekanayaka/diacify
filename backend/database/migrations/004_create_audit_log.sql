USE diacify_db;

CREATE TABLE IF NOT EXISTS audit_log (
  log_id         INT PRIMARY KEY AUTO_INCREMENT,
  clerk_id       VARCHAR(100) NOT NULL,
  action         VARCHAR(20) NOT NULL,
  patient_id     VARCHAR(20),
  changed_fields JSON,
  timestamp      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
