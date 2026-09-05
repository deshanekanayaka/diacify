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
import { createPatientsRouter } from "./patients.js";

config({ path: ".env.test" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run visits.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

const servingModel = loadDefaultServingModel();

interface TestClinician {
  client: SupabaseClient;
  accessToken: string;
  userId: string;
}

async function signUpTestClinician(label: string): Promise<TestClinician> {
  const client = createClient(supabaseUrl!, supabasePublishableKey!);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const { data, error } = await client.auth.signUp({ email, password: "correct horse battery staple" });
  if (error) throw error;
  return { client, accessToken: data.session!.access_token, userId: data.user!.id };
}

function buildApp(visitRateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 })) {
  const app = express();
  app.use(express.json());
  const requireAuth = createRequireAuth(createSupabaseJwks(supabaseUrl!));
  app.use(
    "/api/patients",
    requireAuth,
    createPatientsRouter({
      supabaseUrl: supabaseUrl!,
      supabasePublishableKey: supabasePublishableKey!,
      createPatientRateLimit: createRateLimiter({ limit: 20, windowMs: 60_000 }),
      createVisitRateLimit: visitRateLimit,
      model: servingModel,
    }),
  );
  return app;
}

const validVisit = { age: 54, systolic: 138, diastolic: 88, bmi: 27.4, hba1c: 6.1 };

/** Inserts a visit directly (not through the route under test) for read-path fixtures. */
async function seedVisit(
  client: SupabaseClient,
  patientId: string,
  visitDate: string,
): Promise<string> {
  const { data, error } = await client
    .from("visits")
    .insert({ ...validVisit, patient_id: patientId, visit_date: visitDate })
    .select()
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Inserts a risk assessment directly, so a read test can set up a scored
 * visit without depending on the predict route. `createdAt` is explicit
 * because "latest" is decided by it, and a test that relied on insertion
 * timing would be proving very little.
 */
async function seedAssessment(
  client: SupabaseClient,
  visitId: string,
  modelVersion: string,
  createdAt: string,
  category: "low" | "medium" | "high",
  score: number,
): Promise<void> {
  const { error } = await client.from("risk_assessments").insert({
    visit_id: visitId,
    model_version: modelVersion,
    created_at: createdAt,
    probability_low: 0.2,
    probability_medium: 0.3,
    probability_high: 0.5,
    risk_score: score,
    risk_category: category,
    low_confidence: false,
  });
  if (error) throw error;
}

async function createPatient(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("patients").insert({ sex: "male" }).select().single();
  if (error) throw error;
  return data.id as string;
}

describe("POST /api/patients/:id/visits", () => {
  let app: express.Express;
  let clinicianA: TestClinician;
  let clinicianB: TestClinician;
  let patientOwnedByA: string;
  let patientOwnedByB: string;

  beforeAll(async () => {
    app = buildApp();
    clinicianA = await signUpTestClinician("post-visits-a");
    clinicianB = await signUpTestClinician("post-visits-b");

    const { data: patientA, error: errorA } = await clinicianA.client
      .from("patients")
      .insert({ sex: "male" })
      .select()
      .single();
    if (errorA) throw errorA;
    patientOwnedByA = patientA.id;

    const { data: patientB, error: errorB } = await clinicianB.client
      .from("patients")
      .insert({ sex: "female" })
      .select()
      .single();
    if (errorB) throw errorB;
    patientOwnedByB = patientB.id;
  });

  afterAll(async () => {
    await deleteTestUser(clinicianA.userId);
    await deleteTestUser(clinicianB.userId);
  });

  it("scores the visit it just created", async () => {
    const response = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    expect(response.status).toBe(201);
    const assessment = response.body.data.risk_assessment;
    expect(assessment).not.toBeNull();
    expect(["low", "medium", "high"]).toContain(assessment.risk_category);
    expect(assessment.model_version).toMatch(/^rf-/);
    expect(assessment.risk_score).toBeGreaterThanOrEqual(0);
    expect(assessment.risk_score).toBeLessThanOrEqual(100);
    expect(typeof assessment.low_confidence).toBe("boolean");
    expect(typeof assessment.created_at).toBe("string");
  });

  it("stores that assessment rather than only returning it", async () => {
    const response = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    const { data: rows } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", response.body.data.id);

    expect(rows).toHaveLength(1);
    expect(rows![0]!.risk_category).toBe(response.body.data.risk_assessment.risk_category);
  });

  it("reports the same assessment the visit history then shows", async () => {
    // The two endpoints reach the assessment by different routes - one from
    // the value it just computed, one through a PostgREST embed - so they
    // are worth pinning against each other rather than each against itself.
    const created = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    const history = await request(app)
      .get(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    const fromHistory = history.body.data.find(
      (visit: { id: string }) => visit.id === created.body.data.id,
    );
    expect(fromHistory.risk_assessment).toEqual(created.body.data.risk_assessment);
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .send(validVisit);
    expect(response.status).toBe(401);
  });

  it("creates a visit for the caller's own patient", async () => {
    const response = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ patient_id: patientOwnedByA, hba1c: 6.1 });
  });

  it("returns 404 for a patient id that doesn't exist", async () => {
    const response = await request(app)
      .post("/api/patients/00000000-0000-0000-0000-000000000000/visits")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    expect(response.status).toBe(404);
  });

  it("returns 404 for another clinician's real patient (not 403 or 500)", async () => {
    const response = await request(app)
      .post(`/api/patients/${patientOwnedByB}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed patient id", async () => {
    const response = await request(app)
      .post("/api/patients/not-a-uuid/visits")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send(validVisit);

    expect(response.status).toBe(400);
  });

  it("returns 400 for an out-of-range clinical value and writes nothing", async () => {
    const { count: before } = await clinicianA.client
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientOwnedByA);

    const response = await request(app)
      .post(`/api/patients/${patientOwnedByA}/visits`)
      .set("Authorization", `Bearer ${clinicianA.accessToken}`)
      .send({ ...validVisit, diastolic: 5000 });

    expect(response.status).toBe(400);

    const { count: after } = await clinicianA.client
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientOwnedByA);
    expect(after).toBe(before);
  });
});

describe("GET /api/patients/:id/visits", () => {
  let app: express.Express;
  let clinicianD: TestClinician;
  let clinicianE: TestClinician;
  let patientWithVisits: string;
  let patientWithNoVisits: string;
  let patientWithSameDayVisits: string;
  let patientOwnedByE: string;
  let sameDayVisitIds: string[];
  let patientWithScores: string;
  let scoredTwiceVisitId: string;
  let neverScoredVisitId: string;

  beforeAll(async () => {
    app = buildApp();
    clinicianD = await signUpTestClinician("get-visits-d");
    clinicianE = await signUpTestClinician("get-visits-e");

    patientWithVisits = await createPatient(clinicianD.client);
    patientWithNoVisits = await createPatient(clinicianD.client);
    patientWithSameDayVisits = await createPatient(clinicianD.client);
    patientOwnedByE = await createPatient(clinicianE.client);

    // Seeded out of chronological order so a passing ordering test can't
    // just be reflecting insertion order.
    await seedVisit(clinicianD.client, patientWithVisits, "2026-02-10");
    await seedVisit(clinicianD.client, patientWithVisits, "2026-03-10");
    await seedVisit(clinicianD.client, patientWithVisits, "2026-01-10");

    sameDayVisitIds = [
      await seedVisit(clinicianD.client, patientWithSameDayVisits, "2026-04-01"),
      await seedVisit(clinicianD.client, patientWithSameDayVisits, "2026-04-01"),
    ];

    patientWithScores = await createPatient(clinicianD.client);
    scoredTwiceVisitId = await seedVisit(clinicianD.client, patientWithScores, "2026-05-02");
    neverScoredVisitId = await seedVisit(clinicianD.client, patientWithScores, "2026-05-01");

    // The same visit, scored by an older model and then by a retrained one.
    await seedAssessment(
      clinicianD.client, scoredTwiceVisitId, "rf-oldmodel001",
      "2026-05-02T09:00:00Z", "low", 12.5,
    );
    await seedAssessment(
      clinicianD.client, scoredTwiceVisitId, "rf-newmodel002",
      "2026-06-20T09:00:00Z", "high", 88.25,
    );
  });

  afterAll(async () => {
    await deleteTestUser(clinicianD.userId);
    await deleteTestUser(clinicianE.userId);
  });

  it("carries the visit's latest risk assessment inline", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientWithScores}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(200);
    const scored = response.body.data.find(
      (visit: { id: string }) => visit.id === scoredTwiceVisitId,
    );
    expect(scored.risk_assessment).toEqual({
      model_version: "rf-newmodel002",
      risk_score: 88.25,
      risk_category: "high",
      low_confidence: false,
      created_at: "2026-06-20T09:00:00+00:00",
    });
  });

  it("returns only the newest model version's verdict, not a stale one", async () => {
    // The test that earns ADR-028's append-only design: the older model
    // called this visit low risk, and that row is still on file. A reader
    // must see the retrained model's answer, never both and never the old.
    const response = await request(app)
      .get(`/api/patients/${patientWithScores}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    const scored = response.body.data.find(
      (visit: { id: string }) => visit.id === scoredTwiceVisitId,
    );
    expect(scored.risk_assessment.model_version).toBe("rf-newmodel002");
    expect(scored.risk_assessment.risk_category).not.toBe("low");
    expect(Array.isArray(scored.risk_assessment)).toBe(false);
  });

  it("reports null for a visit that has never been scored", async () => {
    // Absence is how "not yet assessed" is expressed - ADR-028 retired
    // legacy's fourth 'pending' category rather than porting it.
    const response = await request(app)
      .get(`/api/patients/${patientWithScores}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    const unscored = response.body.data.find(
      (visit: { id: string }) => visit.id === neverScoredVisitId,
    );
    expect(unscored.risk_assessment).toBeNull();
  });

  it("does not expose the raw embedded array shape", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientWithScores}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    for (const visit of response.body.data) {
      expect(visit).not.toHaveProperty("risk_assessments");
    }
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app).get(`/api/patients/${patientWithVisits}/visits`);
    expect(response.status).toBe(401);
  });

  it("returns the patient's visits newest visit_date first", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientWithVisits}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.data.map((visit: { visit_date: string }) => visit.visit_date)).toEqual([
      "2026-03-10",
      "2026-02-10",
      "2026-01-10",
    ]);
  });

  it("returns an empty list, not an error, for an owned patient with no visits", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientWithNoVisits}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it("returns 404 for another clinician's real patient (not an empty list)", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientOwnedByE}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a patient id that doesn't exist", async () => {
    const response = await request(app)
      .get("/api/patients/00000000-0000-0000-0000-000000000000/visits")
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed patient id", async () => {
    const response = await request(app)
      .get("/api/patients/not-a-uuid/visits")
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(400);
  });

  it("paginates without repeating or omitting a visit", async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 2; page++) {
      const response = await request(app)
        .get(`/api/patients/${patientWithVisits}/visits`)
        .query({ limit: 2, page })
        .set("Authorization", `Bearer ${clinicianD.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      seen.push(...response.body.data.map((visit: { id: string }) => visit.id));
    }

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });

  it("orders visits sharing a visit_date by entry order, newest first", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientWithSameDayVisits}/visits`)
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((visit: { id: string }) => visit.id)).toEqual([
      sameDayVisitIds[1],
      sameDayVisitIds[0],
    ]);
  });
});

describe("POST /api/patients/:id/visits rate limiting", () => {
  let app: express.Express;
  let clinicianC: TestClinician;
  let patientOwnedByC: string;

  beforeAll(async () => {
    app = buildApp(createRateLimiter({ limit: 2, windowMs: 60_000 }));
    clinicianC = await signUpTestClinician("post-visits-c");

    const { data, error } = await clinicianC.client
      .from("patients")
      .insert({ sex: "male" })
      .select()
      .single();
    if (error) throw error;
    patientOwnedByC = data.id;
  });

  afterAll(async () => {
    await deleteTestUser(clinicianC.userId);
  });

  it("returns 429 once the per-clinician limit is exceeded", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(app)
        .post(`/api/patients/${patientOwnedByC}/visits`)
        .set("Authorization", `Bearer ${clinicianC.accessToken}`)
        .send(validVisit);
      expect(response.status).toBe(201);
    }

    const blocked = await request(app)
      .post(`/api/patients/${patientOwnedByC}/visits`)
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send(validVisit);

    expect(blocked.status).toBe(429);
  });
});
