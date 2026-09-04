import express from "express";
import request from "supertest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSupabaseJwks } from "../auth/supabaseJwks.js";
import { deleteTestUser } from "../db/testCleanup.js";
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
  });

  afterAll(async () => {
    await deleteTestUser(clinicianD.userId);
    await deleteTestUser(clinicianE.userId);
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
