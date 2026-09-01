import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("throws when SUPABASE_URL is not set", () => {
    expect(() => loadEnv({})).toThrow("SUPABASE_URL is not set");
  });

  it("returns the configured Supabase URL", () => {
    const env = loadEnv({ SUPABASE_URL: "https://example.supabase.co" });
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
  });
});
