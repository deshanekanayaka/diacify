-- The first patient-level clinical attribute. Of the three fields legacy
-- stored on patients (sex, social_life, genetics), sex is the only one our
-- own trained model actually consumes (machine-learning/feature_matrix.py):
-- genetics was measured at 0.0003 feature importance and dropped, and
-- social_life was never included. Deliberately not porting the other two
-- speculatively — see context/current-feature.md for the full reasoning.
--
-- An enum, not text + CHECK, so an invalid value is a compile-time error
-- at the .insert() call once `supabase gen types` regenerates
-- database.types.ts, rather than a runtime constraint violation.
--
-- NOT NULL with no default: a patient without a recorded sex isn't a
-- valid patient, and there's no sensible value to invent. Safe because
-- the table has zero rows on both the local stack and the real project
-- at the time of this migration (verified directly before writing this).

create type patient_sex as enum ('male', 'female');

alter table patients
  add column sex patient_sex not null;
