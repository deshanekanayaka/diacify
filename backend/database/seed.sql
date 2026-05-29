USE diabetic_db;

DELETE FROM patients;
ALTER TABLE patients AUTO_INCREMENT = 1;

INSERT INTO patients
(clerk_id, age, sex, social_life, cholesterol, triglycerides, hdl, ldl, vldl,
 bp_systolic, bp_diastolic, hba1c, bmi, rbs, risk_score, risk_category, top_factors, created_at)
VALUES
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 51, 'female', 'city',    174.00,  92.00, 35.00, 125.00, 18.00, 12.0, 8.0, 4.9,  34.30, 94.0,   38.54, 'low',    '["HbA1c", "RBS", "BMI"]', '2026-01-10'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 42, 'male',   'city',    153.00,  72.00, 34.00, 105.00, 14.00, 11.0, 7.5, 5.1,  28.20, 105.0,  40.00, 'medium', '["HbA1c", "RBS", "BMI"]', '2026-01-15'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 34, 'female', 'city',    144.00,  99.00, 36.00, 108.00, 19.00, 12.0, 8.0, 5.0,  23.03, 102.0,  40.00, 'medium', '["HbA1c", "RBS", "BMI"]', '2026-02-03'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 53, 'male',   'city',    159.00, 297.00, 27.00,  99.00, 59.00, 12.0, 9.0, 6.7,  20.80, 145.5,  88.10, 'high',   '["HbA1c", "RBS", "BMI"]', '2026-02-18'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 37, 'male',   'city',    262.00, 234.00, 30.00, 192.00, 47.00, 11.0, 7.5, 5.2,  29.70, 93.0,   39.94, 'low',    '["HbA1c", "RBS", "BMI"]', '2026-02-25'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 26, 'male',   'city',    122.00,  91.00, 29.00,  83.00, 18.00, 11.5, 5.5, 4.8,  25.70, 91.0,   40.00, 'medium', '["HbA1c", "RBS", "BMI"]', '2026-03-05'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 64, 'female', 'village', 104.00, 164.00, 34.00,  41.00, 33.00,  7.6, 5.2, 9.8,  34.60, 234.5,  96.89, 'high',   '["HbA1c", "RBS", "BMI"]', '2026-03-20'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 24, 'male',   'city',    145.00, 104.00, 26.00,  99.00, 21.00, 13.0, 8.0, 4.7,  30.40, 99.0,   39.74, 'low',    '["HbA1c", "RBS", "BMI"]', '2026-03-28'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 58, 'female', 'village', 165.00, 123.00, 44.00,  92.00, 25.00, 13.0, 7.0, 5.4,  35.30, 98.0,   33.58, 'low',    '["HbA1c", "RBS", "BMI"]', '2026-04-10'),
    ('user_3BUc8irbsRLEN45Gdo4jInGbnjW', 72, 'female', 'city',    153.00, 110.00, 35.00,  98.00, 47.00, 15.0, 7.0, 5.9,  28.20, 122.6,  68.25, 'medium', '["HbA1c", "RBS", "BMI"]', '2026-04-20');

SELECT CONCAT('Seeded ', COUNT(*), ' patients') AS status FROM patients;
