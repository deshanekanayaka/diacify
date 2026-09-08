import { describe, expect, it } from "vitest";

import { createPatientSchema } from "./createPatientSchema.js";

describe("createPatientSchema", () => {
  it("accepts a valid body", () => {
    const result = createPatientSchema.safeParse({ sex: "male", reference: "Chart 12" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing sex", () => {
    const result = createPatientSchema.safeParse({ reference: "Chart 12" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sex value", () => {
    const result = createPatientSchema.safeParse({ sex: "other", reference: "Chart 12" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing reference", () => {
    const result = createPatientSchema.safeParse({ sex: "male" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty or whitespace-only reference", () => {
    expect(createPatientSchema.safeParse({ sex: "male", reference: "" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ sex: "male", reference: "   " }).success).toBe(false);
  });

  it("rejects a reference over 40 characters", () => {
    const result = createPatientSchema.safeParse({ sex: "male", reference: "x".repeat(41) });
    expect(result.success).toBe(false);
  });

  it("accepts a reference at exactly 40 characters", () => {
    const result = createPatientSchema.safeParse({ sex: "male", reference: "x".repeat(40) });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown field, e.g. a caller-supplied clinician_id", () => {
    const result = createPatientSchema.safeParse({
      sex: "male",
      reference: "Chart 12",
      clinician_id: "someone-elses-id",
    });
    expect(result.success).toBe(false);
  });
});
