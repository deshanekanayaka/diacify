import { describe, expect, it } from "vitest";

import {
  buildFeatureVector,
  type SupportedFeatureName,
  type VisitMeasurements,
} from "./features.js";
import { loadServingModel } from "./servingModel.js";

const model = loadServingModel(new URL("./model.json", import.meta.url));

const COMPLETE: VisitMeasurements = {
  age: 50,
  systolic: 120,
  diastolic: 80,
  bmi: 26,
  hba1c: 5.4,
  rbs: 100,
  triglycerides: 150,
  hdl: 50,
  ldl: 100,
};

/** Reads one named feature out of a vector ordered by the model's own feature list. */
function featureOf(vector: number[], name: SupportedFeatureName): number {
  return vector[model.featureNames.indexOf(name)]!;
}

describe("buildFeatureVector", () => {
  it("returns one value per feature, in the order the model declares", () => {
    const vector = buildFeatureVector(model, COMPLETE, "female");
    expect(vector).toHaveLength(model.featureNames.length);
    expect(featureOf(vector, "hba1c")).toBe(5.4);
    expect(featureOf(vector, "age")).toBe(50);
    expect(featureOf(vector, "bmi")).toBe(26);
  });

  it("encodes sex as 1 for male and 0 for female", () => {
    expect(featureOf(buildFeatureVector(model, COMPLETE, "male"), "sex_encoded")).toBe(1);
    expect(featureOf(buildFeatureVector(model, COMPLETE, "female"), "sex_encoded")).toBe(0);
  });

  it("imputes a missing lab with the median training used", () => {
    const vector = buildFeatureVector(model, { ...COMPLETE, rbs: null }, "female");
    expect(featureOf(vector, "rbs")).toBe(model.medians.rbs);
  });

  it("keeps a measured zero rather than treating it as missing", () => {
    const vector = buildFeatureVector(model, { ...COMPLETE, rbs: 0 }, "female");
    expect(featureOf(vector, "rbs")).toBe(0);
  });

  it("derives the lipid ratios from the visit's own values", () => {
    const vector = buildFeatureVector(model, COMPLETE, "female");
    expect(featureOf(vector, "tg_hdl_ratio")).toBe(150 / 50);
    expect(featureOf(vector, "ldl_hdl_ratio")).toBe(100 / 50);
  });

  it("falls back to the training ratio medians when HDL cannot divide", () => {
    const vector = buildFeatureVector(model, { ...COMPLETE, hdl: 0 }, "female");
    expect(featureOf(vector, "tg_hdl_ratio")).toBe(model.ratioMedians.tg_hdl_ratio);
    expect(featureOf(vector, "ldl_hdl_ratio")).toBe(model.ratioMedians.ldl_hdl_ratio);
  });

  it("raises the hypertension flag at either threshold, but not below both", () => {
    const flag = (systolic: number, diastolic: number) =>
      featureOf(buildFeatureVector(model, { ...COMPLETE, systolic, diastolic }, "female"),
        "hypertension_flag");
    expect(flag(139, 89)).toBe(0);
    expect(flag(140, 89)).toBe(1);
    expect(flag(139, 90)).toBe(1);
  });

  it("multiplies age by BMI for the interaction feature", () => {
    expect(featureOf(buildFeatureVector(model, COMPLETE, "female"), "age_bmi_interaction"))
      .toBe(50 * 26);
  });
});
