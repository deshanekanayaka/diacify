import { describe, expect, it } from "vitest";

import { type VisitMeasurements } from "./features.js";
import {
  assessRisk,
  calculateRiskScore,
  classifyRisk,
  isLowConfidence,
} from "./riskAssessment.js";
import { loadServingModel } from "./servingModel.js";

const model = loadServingModel(new URL("./model.json", import.meta.url));

const VISIT: VisitMeasurements = {
  age: 55,
  systolic: 145,
  diastolic: 92,
  bmi: 31,
  hba1c: 6.8,
  rbs: 180,
  triglycerides: 200,
  hdl: 38,
  ldl: 130,
};

describe("calculateRiskScore", () => {
  it("weights high risk fully and medium risk half, on a 0-100 scale", () => {
    expect(calculateRiskScore({ low: 0.2, medium: 0.5, high: 0.3 })).toBe(55);
    expect(calculateRiskScore({ low: 1, medium: 0, high: 0 })).toBe(0);
    expect(calculateRiskScore({ low: 0, medium: 0, high: 1 })).toBe(100);
  });

  it("ignores the low probability entirely", () => {
    const score = calculateRiskScore({ low: 0.9, medium: 0.1, high: 0 });
    expect(score).toBe(calculateRiskScore({ low: 0.5, medium: 0.1, high: 0 }));
  });
});

describe("classifyRisk", () => {
  it("takes the most probable class, never a band of the score", () => {
    expect(classifyRisk({ low: 0.5, medium: 0.3, high: 0.2 })).toBe("low");
    expect(classifyRisk({ low: 0.2, medium: 0.6, high: 0.2 })).toBe("medium");
    expect(classifyRisk({ low: 0.1, medium: 0.3, high: 0.6 })).toBe("high");
  });

  it("gives different categories to patients with an identical score", () => {
    // The regression that matters: score and category are computed from the
    // same probabilities but never from each other. Both of these score 50.
    const certainlyMedium = { low: 0, medium: 1, high: 0 };
    const splitOpinion = { low: 0.5, medium: 0, high: 0.5 };

    expect(calculateRiskScore(certainlyMedium)).toBe(calculateRiskScore(splitOpinion));
    expect(classifyRisk(certainlyMedium)).toBe("medium");
    expect(classifyRisk(splitOpinion)).not.toBe("medium");
  });

  it("does not raise the category just because the score is high", () => {
    const probabilities = { low: 0.4, medium: 0.35, high: 0.25 };
    expect(calculateRiskScore(probabilities)).toBeGreaterThan(40);
    expect(classifyRisk(probabilities)).toBe("low");
  });
});

describe("isLowConfidence", () => {
  it("flags a prediction whose top class is below the threshold", () => {
    expect(isLowConfidence({ low: 0.54, medium: 0.23, high: 0.23 })).toBe(true);
  });

  it("does not flag one at or above the threshold", () => {
    expect(isLowConfidence({ low: 0.55, medium: 0.25, high: 0.2 })).toBe(false);
    expect(isLowConfidence({ low: 0.9, medium: 0.05, high: 0.05 })).toBe(false);
  });
});

describe("assessRisk", () => {
  it("returns a full assessment stamped with the model that produced it", () => {
    const assessment = assessRisk(model, VISIT, "male");

    expect(Object.keys(assessment.probabilities).sort()).toEqual(["high", "low", "medium"]);
    expect(assessment.model_version).toBe(model.version);
    expect(assessment.risk_score).toBe(calculateRiskScore(assessment.probabilities));
    expect(assessment.risk_category).toBe(classifyRisk(assessment.probabilities));
    expect(assessment.low_confidence).toBe(isLowConfidence(assessment.probabilities));
  });

  it("is deterministic for the same visit", () => {
    expect(assessRisk(model, VISIT, "male")).toEqual(assessRisk(model, VISIT, "male"));
  });

  it("rates a clearly diabetic profile above a clearly healthy one", () => {
    const healthy: VisitMeasurements = {
      age: 25, systolic: 110, diastolic: 70, bmi: 22, hba1c: 4.9,
      rbs: 85, triglycerides: 90, hdl: 60, ldl: 90,
    };
    expect(assessRisk(model, VISIT, "male").risk_score).toBeGreaterThan(
      assessRisk(model, healthy, "female").risk_score,
    );
  });
});
