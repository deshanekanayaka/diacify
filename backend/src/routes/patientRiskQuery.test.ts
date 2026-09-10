import { describe, expect, it } from "vitest";

import { parsePatientRiskQuery } from "./patientRiskQuery.js";

describe("parsePatientRiskQuery", () => {
  it("defaults to newest with no risk filter when nothing is given", () => {
    const result = parsePatientRiskQuery({});
    expect(result).toEqual({ ok: true, params: { sort: "newest" } });
  });

  it("accepts each risk category as a filter", () => {
    for (const risk of ["low", "medium", "high"]) {
      expect(parsePatientRiskQuery({ risk })).toEqual({
        ok: true,
        params: { sort: "newest", risk },
      });
    }
  });

  it("accepts unscored as a filter", () => {
    const result = parsePatientRiskQuery({ risk: "unscored" });
    expect(result).toEqual({ ok: true, params: { sort: "newest", risk: "unscored" } });
  });

  it("rejects an unknown risk value", () => {
    const result = parsePatientRiskQuery({ risk: "critical" });
    expect(result).toEqual({ ok: false, error: "Invalid value for risk parameter" });
  });

  it("accepts sort=risk", () => {
    const result = parsePatientRiskQuery({ sort: "risk" });
    expect(result).toEqual({ ok: true, params: { sort: "risk" } });
  });

  it("rejects an unknown sort value", () => {
    const result = parsePatientRiskQuery({ sort: "oldest" });
    expect(result).toEqual({ ok: false, error: "Invalid value for sort parameter" });
  });

  it("accepts risk and sort together", () => {
    const result = parsePatientRiskQuery({ risk: "high", sort: "risk" });
    expect(result).toEqual({ ok: true, params: { sort: "risk", risk: "high" } });
  });
});
