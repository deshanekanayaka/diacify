import { describe, expect, it } from "vitest";

import { createPatientSchema } from "./createPatientSchema.js";

describe("createPatientSchema", () => {
  it("accepts a valid body", () => {
    const result = createPatientSchema.safeParse({ sex: "male" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing sex", () => {
    const result = createPatientSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sex value", () => {
    const result = createPatientSchema.safeParse({ sex: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown field, e.g. a caller-supplied clinician_id", () => {
    const result = createPatientSchema.safeParse({ sex: "male", clinician_id: "someone-elses-id" });
    expect(result.success).toBe(false);
  });
});
