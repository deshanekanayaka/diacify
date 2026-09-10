import { describe, expect, it, vi } from "vitest";

import { formatDate } from "./format";

// Matches formatDate's own options - the oracle below constructs the Date
// object formatDate *should* end up with and formats it the same way,
// rather than hardcoding a locale-specific string (Node's default locale
// varies by environment).
const DATE_FORMAT_OPTIONS = { day: "numeric", month: "short", year: "numeric" } as const;

describe("formatDate", () => {
  it("does not shift a date-only string a day earlier in a timezone behind UTC", () => {
    // new Date("2026-09-08") parses as UTC midnight; in any timezone behind
    // UTC that instant is still the evening of the 7th, so a naive
    // `new Date(iso).toLocaleDateString()` renders the wrong day here.
    vi.stubEnv("TZ", "America/Los_Angeles");

    const correctLocalMidnight = new Date(2026, 8, 8); // month is 0-indexed
    expect(formatDate("2026-09-08")).toBe(
      correctLocalMidnight.toLocaleDateString(undefined, DATE_FORMAT_OPTIONS),
    );

    vi.unstubAllEnvs();
  });

  it("still formats a full timestamp correctly", () => {
    const timestamp = "2026-09-08T09:18:54.727172+00:00";
    expect(formatDate(timestamp)).toBe(new Date(timestamp).toLocaleDateString(undefined, DATE_FORMAT_OPTIONS));
  });
});
