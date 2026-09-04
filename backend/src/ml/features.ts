import type { Database } from "../db/database.types.js";
import type { ServingModel } from "./servingModel.js";

export type PatientSex = Database["public"]["Enums"]["patient_sex"];

/**
 * The visit measurements the model reads. Deliberately narrower than a full
 * `visits` row: cholesterol and VLDL are recorded clinically (ADR-019) but
 * never reach the model, so passing the whole row would suggest otherwise.
 */
export interface VisitMeasurements {
  age: number;
  systolic: number;
  diastolic: number;
  bmi: number;
  hba1c: number;
  rbs: number | null;
  triglycerides: number | null;
  hdl: number | null;
  ldl: number | null;
}

// Mirrors machine-learning/features.py::engineer_features - a reading at or
// above either threshold counts as hypertensive.
const HYPERTENSION_SYSTOLIC_MMHG = 140;
const HYPERTENSION_DIASTOLIC_MMHG = 90;

const MALE_ENCODED = 1;
const FEMALE_ENCODED = 0;

/**
 * Builds the numeric vector the forest consumes from one visit and its patient.
 *
 * Missing labs are filled with the medians computed at training time and
 * shipped inside the model, so a value the clinician left blank is treated the
 * same way here as it was when the model learned - the train/serve parity that
 * BUGS.md records getting wrong before.
 *
 * @param model The serving model, for its feature order and training medians.
 * @param visit The visit's measurements; nulls mean "not measured".
 * @param sex The patient's recorded sex.
 * @returns Feature values ordered to match model.featureNames.
 */
export function buildFeatureVector(
  model: ServingModel,
  visit: VisitMeasurements,
  sex: PatientSex,
): number[] {
  const { medians, ratioMedians } = model;

  // ?? not ||: a measured 0 is a real value, only null means not measured.
  const hdl = visit.hdl ?? medians.hdl;
  const triglycerides = visit.triglycerides ?? medians.trig;
  const ldl = visit.ldl ?? medians.ldl;
  const canDivideByHdl = hdl > 0;

  const values: Record<string, number> = {
    hba1c: visit.hba1c,
    age: visit.age,
    sex_encoded: sex === "male" ? MALE_ENCODED : FEMALE_ENCODED,
    bmi: visit.bmi,
    systolic: visit.systolic,
    diastolic: visit.diastolic,
    rbs: visit.rbs ?? medians.rbs,
    tg_hdl_ratio: canDivideByHdl ? triglycerides / hdl : ratioMedians.tg_hdl_ratio,
    ldl_hdl_ratio: canDivideByHdl ? ldl / hdl : ratioMedians.ldl_hdl_ratio,
    trig: triglycerides,
    hdl,
    hypertension_flag:
      visit.systolic >= HYPERTENSION_SYSTOLIC_MMHG ||
      visit.diastolic >= HYPERTENSION_DIASTOLIC_MMHG
        ? 1
        : 0,
    age_bmi_interaction: visit.age * visit.bmi,
  };

  return model.featureNames.map((name) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Serving model expects a feature this build step does not produce: ${name}`);
    }
    return value;
  });
}
