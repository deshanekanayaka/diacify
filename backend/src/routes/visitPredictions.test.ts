import express from "express";
import request from "supertest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSupabaseJwks } from "../auth/supabaseJwks.js";
import { deleteTestUser } from "../db/testCleanup.js";
import { loadDefaultServingModel } from "../ml/servingModel.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { createRequireAuth } from "../middleware/requireAuth.js";
import { createVisitPredictionsRouter } from "./visitPredictions.js";

config({ path: ".env.test" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run visitPredictions.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

const model = loadDefaultServingModel();

interface TestClinician {
  client: SupabaseClient;
  accessToken: string;
  userId: string;
}

async function signUpTestClinician(label: string): Promise<TestClinician> {
  const client = createClient(supabaseUrl!, supabasePublishableKey!);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const { data, error } = await client.auth.signUp({
    email,
    password: "correct horse battery staple",
  });
  if (error) throw error;
  return { client, accessToken: data.session!.access_token, userId: data.user!.id };
}

function buildApp(predictRateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 })) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/visits",
    createRequireAuth(createSupabaseJwks(supabaseUrl!)),
    createVisitPredictionsRouter({
      supabaseUrl: supabaseUrl!,
      supabasePublishableKey: supabasePublishableKey!,
      model,
      predictRateLimit,
    }),
  );
  return app;
}

const COMPLETE_VISIT = {
  age: 54, systolic: 145, diastolic: 92, bmi: 31.2, hba1c: 6.8,
  rbs: 180, triglycerides: 210, hdl: 38, ldl: 132,
};

// Scores with probabilities spread across two classes, so precision
// assertions have something to actually bite on.
const BORDERLINE_VISIT = {
  age: 45, systolic: 128, diastolic: 82, bmi: 27.0, hba1c: 5.8,
  rbs: 110, triglycerides: 140, hdl: 48, ldl: 110,
};

async function seedVisit(
  client: SupabaseClient,
  measurements: Record<string, number | null> = COMPLETE_VISIT,
): Promise<string> {
  const { data: patient, error: patientError } = await client
    .from("patients").insert({ sex: "male" }).select().single();
  if (patientError) throw patientError;

  const { data, error } = await client
    .from("visits").insert({ ...measurements, patient_id: patient.id }).select().single();
  if (error) throw error;
  return data.id as string;
}

describe("POST /api/visits/:id/predict", () => {
  let app: express.Express;
  let clinician: TestClinician;
  let otherClinician: TestClinician;

  beforeAll(async () => {
    app = buildApp();
    clinician = await signUpTestClinician("predict-owner");
    otherClinician = await signUpTestClinician("predict-other");
  });

  afterAll(async () => {
    await deleteTestUser(clinician.userId);
    await deleteTestUser(otherClinician.userId);
  });

  it("rejects an unauthenticated request", async () => {
    const visitId = await seedVisit(clinician.client);
    const response = await request(app).post(`/api/visits/${visitId}/predict`);
    expect(response.status).toBe(401);
  });

  it("scores the caller's own visit", async () => {
    const visitId = await seedVisit(clinician.client);

    const response = await request(app)
      .post(`/api/visits/${visitId}/predict`)
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.visit_id).toBe(visitId);
    expect(response.body.data.model_version).toBe(model.version);
    expect(["low", "medium", "high"]).toContain(response.body.data.risk_category);
    expect(response.body.data.risk_score).toBeGreaterThanOrEqual(0);
    expect(response.body.data.risk_score).toBeLessThanOrEqual(100);
    expect(Object.keys(response.body.data.probabilities).sort())
      .toEqual(["high", "low", "medium"]);
    expect(typeof response.body.data.low_confidence).toBe("boolean");
  });

  it("returns the same assessment when called again", async () => {
    const visitId = await seedVisit(clinician.client);
    const send = () =>
      request(app)
        .post(`/api/visits/${visitId}/predict`)
        .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect((await send()).body).toEqual((await send()).body);
  });

  it("scores a visit whose optional labs were never measured", async () => {
    const visitId = await seedVisit(clinician.client, {
      age: 61, systolic: 130, diastolic: 84, bmi: 29.5, hba1c: 5.9,
      rbs: null, triglycerides: null, hdl: null, ldl: null,
    });

    const response = await request(app)
      .post(`/api/visits/${visitId}/predict`)
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect(response.status).toBe(200);
    expect(["low", "medium", "high"]).toContain(response.body.data.risk_category);
  });

  it("stores the assessment it returns", async () => {
    // BORDERLINE_VISIT deliberately: COMPLETE_VISIT scores an unambiguous
    // 0/0/1, which would round-trip at any precision and prove nothing.
    const visitId = await seedVisit(clinician.client, BORDERLINE_VISIT);

    const response = await request(app)
      .post(`/api/visits/${visitId}/predict`)
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    const { data: stored } = await clinician.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visitId)
      .single();

    expect(stored!.model_version).toBe(response.body.data.model_version);
    expect(stored!.risk_category).toBe(response.body.data.risk_category);
    expect(Number(stored!.risk_score)).toBe(response.body.data.risk_score);
    expect(stored!.low_confidence).toBe(response.body.data.low_confidence);

    // Not strict equality, deliberately. double precision stores the value
    // bit-for-bit - verified directly in Postgres, where the stored column
    // compares equal to the literal we wrote - but PostgREST renders float8
    // as text at 15 significant digits, so a value read back over the API
    // differs from the computed one in the 16th. That is ~1e-16 on a
    // probability, and nothing is recomputed from it (risk_score and
    // risk_category are stored in their own columns), so this is a
    // documented read precision rather than a defect to design around.
    expect(stored!.probability_medium).toBeCloseTo(
      response.body.data.probabilities.medium,
      15,
    );
    expect(stored!.probability_high).toBeCloseTo(response.body.data.probabilities.high, 15);
  });

  it("stores one row however many times it is called", async () => {
    const visitId = await seedVisit(clinician.client);
    const send = () =>
      request(app)
        .post(`/api/visits/${visitId}/predict`)
        .set("Authorization", `Bearer ${clinician.accessToken}`);

    await send();
    const { data: first } = await clinician.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visitId)
      .single();

    await send();
    await send();

    const { data: rows } = await clinician.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visitId);
    expect(rows).toHaveLength(1);
    // created_at records when the judgement was first made, so a re-score
    // must not move it. The append-only grants make that structural rather
    // than a matter of writing the insert carefully, but it is the property
    // that actually matters, so it stays pinned independently of mechanism.
    expect(rows![0]!.created_at).toBe(first!.created_at);
  });

  it("does not store anything for another clinician's visit", async () => {
    const visitId = await seedVisit(otherClinician.client);

    await request(app)
      .post(`/api/visits/${visitId}/predict`)
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    const { data: rows } = await otherClinician.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visitId);
    expect(rows).toHaveLength(0);
  });

  it("returns 429 once the rate limit is exceeded", async () => {
    const limitedApp = buildApp(createRateLimiter({ limit: 2, windowMs: 60_000 }));
    const visitId = await seedVisit(clinician.client);
    const send = () =>
      request(limitedApp)
        .post(`/api/visits/${visitId}/predict`)
        .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it("returns 404 for another clinician's visit", async () => {
    const visitId = await seedVisit(otherClinician.client);

    const response = await request(app)
      .post(`/api/visits/${visitId}/predict`)
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Visit not found" });
  });

  it("returns 404 for a visit that does not exist", async () => {
    const response = await request(app)
      .post("/api/visits/00000000-0000-4000-8000-000000000000/predict")
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Visit not found" });
  });

  it("returns 400 for a malformed visit id", async () => {
    const response = await request(app)
      .post("/api/visits/not-a-uuid/predict")
      .set("Authorization", `Bearer ${clinician.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid visit id" });
  });
});
