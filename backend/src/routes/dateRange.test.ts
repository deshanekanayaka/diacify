import { describe, expect, it } from "vitest";

import { parseDateRange } from "./dateRange.js";

describe("parseDateRange", () => {
  it("is unfiltered when neither from nor to is given", () => {
    const result = parseDateRange({});
    expect(result).toEqual({ ok: true, params: {} });
  });

  it("accepts from only", () => {
    const result = parseDateRange({ from: "2026-02-01" });
    expect(result).toEqual({ ok: true, params: { from: "2026-02-01" } });
  });

  it("accepts to only", () => {
    const result = parseDateRange({ to: "2026-02-15" });
    expect(result).toEqual({ ok: true, params: { to: "2026-02-15" } });
  });

  it("accepts from and to together", () => {
    const result = parseDateRange({ from: "2026-02-01", to: "2026-02-15" });
    expect(result).toEqual({ ok: true, params: { from: "2026-02-01", to: "2026-02-15" } });
  });

  it("accepts from equal to to (a single-day filter)", () => {
    const result = parseDateRange({ from: "2026-02-10", to: "2026-02-10" });
    expect(result).toEqual({ ok: true, params: { from: "2026-02-10", to: "2026-02-10" } });
  });

  it("rejects a malformed from", () => {
    const result = parseDateRange({ from: "not-a-date" });
    expect(result).toEqual({ ok: false, error: "Invalid value for from parameter" });
  });

  it("rejects a malformed to", () => {
    const result = parseDateRange({ to: "2026/02/15" });
    expect(result).toEqual({ ok: false, error: "Invalid value for to parameter" });
  });

  it("rejects from after to", () => {
    const result = parseDateRange({ from: "2026-03-01", to: "2026-02-01" });
    expect(result).toEqual({ ok: false, error: "from must not be after to" });
  });
});
