import type { CreateVisitInput } from "../api/visits";

/**
 * The measurements this form collects, split by what the risk model does with
 * them. Ordered as a consult produces them, not alphabetically.
 *
 * `step` mirrors each column's decimal scale in the migration — the backend
 * rejects a value with more decimal places than Postgres can store, so the
 * input should not offer one.
 */
export const REQUIRED_MEASUREMENTS = [
  { name: "age", label: "Age", unit: "years", step: "1" },
  { name: "systolic", label: "Systolic", unit: "mmHg", step: "0.1" },
  { name: "diastolic", label: "Diastolic", unit: "mmHg", step: "0.1" },
  { name: "bmi", label: "BMI", unit: "kg/m²", step: "0.01" },
  { name: "hba1c", label: "HbA1c", unit: "%", step: "0.01" },
] as const;

// Scored: the model fills a blank one with the median it learned at training
// time, so leaving it out is safe but less informative.
export const SCORED_LABS = [
  { name: "rbs", label: "Random blood sugar", unit: "mg/dL" },
  { name: "triglycerides", label: "Triglycerides", unit: "mg/dL" },
  { name: "hdl", label: "HDL", unit: "mg/dL" },
  { name: "ldl", label: "LDL", unit: "mg/dL" },
] as const;

// Recorded but not scored: the model was never trained on these two. They are
// kept on the visit because they are part of a lipid panel a clinician reads.
export const RECORDED_LABS = [
  { name: "cholesterol", label: "Total cholesterol", unit: "mg/dL" },
  { name: "vldl", label: "VLDL", unit: "mg/dL" },
] as const;

export type MeasurementName = keyof Omit<CreateVisitInput, "visit_date">;

/**
 * Turns the form's strings into the request body.
 *
 * A blank optional lab is dropped rather than sent as null or 0: the backend
 * schema rejects unknown shapes, and 0 is a real (implausible) measurement,
 * not "not measured". The five required values are read directly — the form
 * marks them `required`, so the browser will not submit without them.
 */
export function toCreateVisitInput(
  visitDate: string,
  values: Partial<Record<MeasurementName, string>>,
): CreateVisitInput {
  const labs: Record<string, number> = {};
  for (const lab of [...SCORED_LABS, ...RECORDED_LABS]) {
    const raw = values[lab.name];
    if (raw !== undefined && raw !== "") {
      labs[lab.name] = Number(raw);
    }
  }

  return {
    visit_date: visitDate,
    age: Number(values.age),
    systolic: Number(values.systolic),
    diastolic: Number(values.diastolic),
    bmi: Number(values.bmi),
    hba1c: Number(values.hba1c),
    ...labs,
  };
}
