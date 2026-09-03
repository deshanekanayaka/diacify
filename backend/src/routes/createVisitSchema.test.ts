import { describe, expect, it } from "vitest";

import { createVisitSchema } from "./createVisitSchema.js";

const FIXED_NOW = () => new Date("2026-09-03T12:00:00.000Z");

const validVisit = {
  age: 54,
  systolic: 138,
  diastolic: 88,
  bmi: 27.4,
  hba1c: 6.1,
};

describe("createVisitSchema", () => {
  it("accepts a valid body with only the required fields", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse(validVisit);
    expect(result.success).toBe(true);
  });

  it("accepts a valid body with optional lab values present", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({
      ...validVisit,
      rbs: 110,
      cholesterol: 180,
      triglycerides: 140,
      hdl: 45,
      ldl: 100,
      vldl: 28,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const withoutHba1c: Partial<typeof validVisit> = { ...validVisit };
    delete withoutHba1c.hba1c;
    const result = createVisitSchema(FIXED_NOW).safeParse(withoutHba1c);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown field", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, patient_id: "someone-elses" });
    expect(result.success).toBe(false);
  });

  it("rejects a diastolic below the implausible-mmHg floor", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, diastolic: 29 });
    expect(result.success).toBe(false);
  });

  it("rejects a systolic above the plausible ceiling", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, systolic: 301 });
    expect(result.success).toBe(false);
  });

  it("rejects a BMI below the plausible floor", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, bmi: 9.9 });
    expect(result.success).toBe(false);
  });

  it("rejects a BMI above the plausible ceiling", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, bmi: 70.1 });
    expect(result.success).toBe(false);
  });

  it("rejects an RBS below the plausible floor", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, rbs: 29 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative optional lab value", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, hdl: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts systolic/diastolic with one decimal place, matching the column's scale", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, systolic: 138.7, diastolic: 88.3 });
    expect(result.success).toBe(true);
  });

  it("rejects systolic with more decimal precision than the column can store", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, systolic: 138.76 });
    expect(result.success).toBe(false);
  });

  it("accepts bmi/hba1c with two decimal places, matching the column's scale", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, bmi: 27.43, hba1c: 6.15 });
    expect(result.success).toBe(true);
  });

  it("rejects hba1c with more decimal precision than the column can store", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, hba1c: 6.155 });
    expect(result.success).toBe(false);
  });

  it("rejects an optional lab value with more decimal precision than the column can store", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, rbs: 110.555 });
    expect(result.success).toBe(false);
  });

  it("accepts visit_date equal to today", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, visit_date: "2026-09-03" });
    expect(result.success).toBe(true);
  });

  it("accepts visit_date one day in the future (timezone skew tolerance)", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, visit_date: "2026-09-04" });
    expect(result.success).toBe(true);
  });

  it("rejects visit_date more than one day in the future", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, visit_date: "2026-09-05" });
    expect(result.success).toBe(false);
  });

  it("accepts visit_date in the past", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse({ ...validVisit, visit_date: "2020-01-01" });
    expect(result.success).toBe(true);
  });

  it("defaults visit_date to undefined (server applies current_date) when omitted", () => {
    const result = createVisitSchema(FIXED_NOW).safeParse(validVisit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visit_date).toBeUndefined();
    }
  });
});
