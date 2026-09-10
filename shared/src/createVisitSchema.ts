import { z } from "zod";

// Same constants as machine-learning/clinical_fields.py, reused rather than
// reinvented so training-data cleaning and real-time entry agree on the
// same plausibility floor.
const MIN_PLAUSIBLE_BMI = 10;
const MAX_PLAUSIBLE_BMI = 70;
const MIN_PLAUSIBLE_RBS = 30;
const MIN_PLAUSIBLE_MMHG = 30;

// Everything below has no existing project precedent - clinical_fields.py
// only ever clips or corrects historical CSV rows, it never rejects an
// upper bound, because its job is salvaging old data, not validating live
// entry. These are generous "reject only what's essentially impossible"
// ceilings, not clinically derived limits.
const MAX_PLAUSIBLE_SYSTOLIC_MMHG = 300;
const MAX_PLAUSIBLE_DIASTOLIC_MMHG = 200;
const MAX_PLAUSIBLE_AGE = 120;
const MIN_PLAUSIBLE_HBA1C = 2;
const MAX_PLAUSIBLE_HBA1C = 20;
const MAX_PLAUSIBLE_LAB_VALUE = 2000;

const FUTURE_DATE_TOLERANCE_DAYS = 1;

// Matches each column's declared decimal scale (numeric(_, 1) or
// numeric(_, 2) in the migration) - without this, a value with more
// decimal digits than the column can store passes validation and is
// silently rounded by Postgres on insert, so the persisted value quietly
// differs from what the clinician entered.
const ONE_DECIMAL_PLACE = 0.1;
const TWO_DECIMAL_PLACES = 0.01;

const nullableLabValue = z
  .number()
  .min(0)
  .max(MAX_PLAUSIBLE_LAB_VALUE)
  .multipleOf(TWO_DECIMAL_PLACES)
  .optional();

/**
 * Builds the Zod schema for POST /api/patients/:id/visits. `now` is
 * injectable so the future-date rule is testable without a real clock;
 * defaults to the real one in production.
 *
 * `.strict()` rejects any unknown field, same reasoning as
 * createPatientSchema - in particular, a caller sending patient_id here
 * gets told no rather than silently ignored, since ownership comes from
 * the URL param and the visits RLS policy's WITH CHECK, never the body.
 */
export function createVisitSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      visit_date: z.string().date().optional(),
      age: z.number().int().min(0).max(MAX_PLAUSIBLE_AGE),
      systolic: z
        .number()
        .min(MIN_PLAUSIBLE_MMHG)
        .max(MAX_PLAUSIBLE_SYSTOLIC_MMHG)
        .multipleOf(ONE_DECIMAL_PLACE),
      diastolic: z
        .number()
        .min(MIN_PLAUSIBLE_MMHG)
        .max(MAX_PLAUSIBLE_DIASTOLIC_MMHG)
        .multipleOf(ONE_DECIMAL_PLACE),
      bmi: z.number().min(MIN_PLAUSIBLE_BMI).max(MAX_PLAUSIBLE_BMI).multipleOf(TWO_DECIMAL_PLACES),
      hba1c: z
        .number()
        .min(MIN_PLAUSIBLE_HBA1C)
        .max(MAX_PLAUSIBLE_HBA1C)
        .multipleOf(TWO_DECIMAL_PLACES),
      rbs: z
        .number()
        .min(MIN_PLAUSIBLE_RBS)
        .max(MAX_PLAUSIBLE_LAB_VALUE)
        .multipleOf(TWO_DECIMAL_PLACES)
        .optional(),
      cholesterol: nullableLabValue,
      triglycerides: nullableLabValue,
      hdl: nullableLabValue,
      ldl: nullableLabValue,
      vldl: nullableLabValue,
    })
    .strict()
    .refine((visit) => isNotTooFarInFuture(visit.visit_date, now), {
      message: `visit_date cannot be more than ${FUTURE_DATE_TOLERANCE_DAYS} day(s) in the future`,
      path: ["visit_date"],
    });
}

export type CreateVisitInput = z.infer<ReturnType<typeof createVisitSchema>>;

/**
 * A visit is an observation that already happened, not a scheduled future
 * event (that's an appointment) - but "in the future" is checked with a
 * day of tolerance for timezone skew: validating a clinician's local date
 * against the server's UTC date would reject legitimate same-day entries
 * for anyone ahead of UTC (Diacify's own clinical context, Erbil, is
 * UTC+3).
 */
function isNotTooFarInFuture(visitDate: string | undefined, now: () => Date): boolean {
  if (visitDate === undefined) return true;

  const latestAllowedDate = new Date(now());
  latestAllowedDate.setUTCDate(latestAllowedDate.getUTCDate() + FUTURE_DATE_TOLERANCE_DAYS);
  const latestAllowed = latestAllowedDate.toISOString().slice(0, 10);

  return visitDate <= latestAllowed;
}
