import express from "express";
import request from "supertest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

import { createSupabaseJwks } from "../auth/supabaseJwks.js";
import { createRequireAuth } from "../middleware/requireAuth.js";
import { createPatientsRouter } from "./patients.js";

config({ path: ".env.test" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run patients.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

async function signUpTestClinician(label: string): Promise<{ client: SupabaseClient; accessToken: string }> {
  const client = createClient(supabaseUrl!, supabasePublishableKey!);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const { data, error } = await client.auth.signUp({ email, password: "correct horse battery staple" });
  if (error) throw error;
  return { client, accessToken: data.session!.access_token };
}

function buildApp() {
  const app = express();
  const requireAuth = createRequireAuth(createSupabaseJwks(supabaseUrl!));
  app.use("/api/patients", requireAuth, createPatientsRouter(supabaseUrl!, supabasePublishableKey!));
  return app;
}

describe("GET /api/patients", () => {
  let app: express.Express;
  let clinicianA: { client: SupabaseClient; accessToken: string };
  let clinicianB: { client: SupabaseClient; accessToken: string };

  beforeAll(async () => {
    app = buildApp();
    clinicianA = await signUpTestClinician("get-patients-a");
    clinicianB = await signUpTestClinician("get-patients-b");

    for (let i = 0; i < 3; i++) {
      const { error } = await clinicianA.client.from("patients").insert({});
      if (error) throw error;
    }
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app).get("/api/patients");
    expect(response.status).toBe(401);
  });

  it("returns only the caller's own patients, newest first", async () => {
    const response = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.data).toHaveLength(3);
  });

  it("returns an empty list for a clinician with no patients", async () => {
    const response = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianB.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], page: 1, limit: 20, total: 0 });
  });

  it("paginates with limit and page", async () => {
    const response = await request(app)
      .get("/api/patients?limit=2&page=1")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.total).toBe(3);
    expect(response.body.limit).toBe(2);
  });

  it("rejects a non-numeric limit with 400", async () => {
    const response = await request(app)
      .get("/api/patients?limit=abc")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid value for limit parameter" });
  });

  it("rejects page=0 with 400", async () => {
    const response = await request(app)
      .get("/api/patients?page=0")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid value for page parameter" });
  });
});
