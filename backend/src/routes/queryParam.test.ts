import { describe, expect, it } from "vitest";

import { parseField } from "./queryParam.js";

describe("parseField", () => {
  it("returns undefined when the value is absent", () => {
    expect(parseField(undefined, (raw) => raw)).toBeUndefined();
  });

  it("returns null when the value isn't a string", () => {
    expect(parseField(["a", "b"], (raw) => raw)).toBeNull();
  });

  it("returns null when validate rejects the value", () => {
    expect(parseField("x", () => null)).toBeNull();
  });

  it("returns validate's result when it accepts the value", () => {
    expect(parseField("5", (raw) => Number(raw))).toBe(5);
  });
});
