import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("throws when SUPABASE_URL is not set", () => {
    expect(() =>
      loadEnv({
        SUPABASE_PUBLISHABLE_KEY: "key",
        ALLOWED_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow("SUPABASE_URL is not set");
  });

  it("throws when SUPABASE_PUBLISHABLE_KEY is not set", () => {
    expect(() =>
      loadEnv({
        SUPABASE_URL: "https://example.supabase.co",
        ALLOWED_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow("SUPABASE_PUBLISHABLE_KEY is not set");
  });

  it("throws when ALLOWED_ORIGIN is not set", () => {
    expect(() =>
      loadEnv({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "key",
      }),
    ).toThrow("ALLOWED_ORIGIN is not set");
  });

  it("returns the configured Supabase URL, publishable key, and allowed origin", () => {
    const env = loadEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      ALLOWED_ORIGIN: "http://localhost:5173",
    });
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.supabasePublishableKey).toBe("sb_publishable_example");
    expect(env.allowedOrigin).toBe("http://localhost:5173");
  });
});
