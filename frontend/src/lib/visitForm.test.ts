import { describe, expect, it } from "vitest";

import { toCreateVisitInput } from "./visitForm";

describe("toCreateVisitInput", () => {
  it("sends the five required measurements as numbers", () => {
    const input = toCreateVisitInput("2026-09-10", {
      age: "58",
      systolic: "148",
      diastolic: "92",
      bmi: "33.4",
      hba1c: "8.6",
    });

    expect(input).toEqual({
      visit_date: "2026-09-10",
      age: 58,
      systolic: 148,
      diastolic: 92,
      bmi: 33.4,
      hba1c: 8.6,
    });
  });

  it("omits a blank lab rather than sending zero for it", () => {
    const input = toCreateVisitInput("2026-09-10", {
      age: "58",
      systolic: "148",
      diastolic: "92",
      bmi: "33.4",
      hba1c: "8.6",
      hdl: "",
      ldl: "0",
    });

    expect(input).not.toHaveProperty("hdl");
    expect(input.ldl).toBe(0);
  });
});
