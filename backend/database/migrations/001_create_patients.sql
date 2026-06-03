USE diacify_db;

CREATE TABLE IF NOT EXISTS patients (
  patient_id   VARCHAR(20) PRIMARY KEY,
  clerk_id     VARCHAR(100) NOT NULL,
  sex          VARCHAR(10) NOT NULL,
  social_life  VARCHAR(10) NOT NULL,
  genetics     VARCHAR(20) DEFAULT '0',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
