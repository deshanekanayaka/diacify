import { describe, expect, it } from "vitest";

import { parsePagination } from "./pagination.js";

describe("parsePagination", () => {
  it("defaults to limit 20, page 1 when neither is given", () => {
    const result = parsePagination({});
    expect(result).toEqual({ ok: true, params: { limit: 20, page: 1 } });
  });

  it("accepts explicit valid limit and page", () => {
    const result = parsePagination({ limit: "5", page: "2" });
    expect(result).toEqual({ ok: true, params: { limit: 5, page: 2 } });
  });

  it("clamps limit above 100 down to 100 rather than rejecting it", () => {
    const result = parsePagination({ limit: "500" });
    expect(result).toEqual({ ok: true, params: { limit: 100, page: 1 } });
  });

  it("rejects a non-numeric limit", () => {
    const result = parsePagination({ limit: "abc" });
    expect(result).toEqual({ ok: false, error: "Invalid value for limit parameter" });
  });

  it("rejects a zero limit", () => {
    const result = parsePagination({ limit: "0" });
    expect(result).toEqual({ ok: false, error: "Invalid value for limit parameter" });
  });

  it("rejects a negative limit", () => {
    const result = parsePagination({ limit: "-1" });
    expect(result).toEqual({ ok: false, error: "Invalid value for limit parameter" });
  });

  it("rejects a non-numeric page", () => {
    const result = parsePagination({ page: "abc" });
    expect(result).toEqual({ ok: false, error: "Invalid value for page parameter" });
  });

  it("rejects a zero page", () => {
    const result = parsePagination({ page: "0" });
    expect(result).toEqual({ ok: false, error: "Invalid value for page parameter" });
  });

  it("rejects a page beyond Number.MAX_SAFE_INTEGER", () => {
    const result = parsePagination({ page: "99999999999999999999" });
    expect(result).toEqual({ ok: false, error: "Invalid value for page parameter" });
  });

  it("rejects a limit beyond Number.MAX_SAFE_INTEGER", () => {
    const result = parsePagination({ limit: "99999999999999999999" });
    expect(result).toEqual({ ok: false, error: "Invalid value for limit parameter" });
  });
});
