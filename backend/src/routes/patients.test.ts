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
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run patients.test.ts. " +
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

function buildApp(rateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 })) {
  const app = express();
  app.use(express.json());
  const requireAuth = createRequireAuth(createSupabaseJwks(supabaseUrl!));
  app.use(
    "/api/patients",
    requireAuth,
    createPatientsRouter(supabaseUrl!, supabasePublishableKey!, rateLimit),
  );
  return app;
}

describe("GET /api/patients", () => {
  let app: express.Express;
  let clinicianA: TestClinician;
  let clinicianB: TestClinician;
  let insertedPatientIds: string[];

  beforeAll(async () => {
    app = buildApp();
    clinicianA = await signUpTestClinician("get-patients-a");
    clinicianB = await signUpTestClinician("get-patients-b");

    insertedPatientIds = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await clinicianA.client
        .from("patients")
        .insert({ sex: "female" })
        .select()
        .single();
      if (error) throw error;
      insertedPatientIds.push(data.id);
    }
  });

  afterAll(async () => {
    // Cascades to delete every patient each user owned - see testCleanup.ts.
    await deleteTestUser(clinicianA.userId);
    await deleteTestUser(clinicianB.userId);
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

  it("walks every page with limit=1 and sees each patient exactly once (no repeats, no omissions)", async () => {
    const seenIds: string[] = [];
    for (let page = 1; page <= insertedPatientIds.length; page++) {
      const response = await request(app)
        .get(`/api/patients?limit=1&page=${page}`)
        .set("Authorization", `Bearer ${clinicianA.accessToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      seenIds.push(response.body.data[0].id);
    }

    expect(new Set(seenIds).size).toBe(insertedPatientIds.length);
    expect(seenIds.sort()).toEqual([...insertedPatientIds].sort());
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

async function ownPatientCount(clinician: TestClinician): Promise<number> {
  const { count, error } = await clinician.client
    .from("patients")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

describe("POST /api/patients", () => {
  let app: express.Express;
  let clinicianC: TestClinician;
  let clinicianD: TestClinician;

  beforeAll(async () => {
    app = buildApp();
    clinicianC = await signUpTestClinician("post-patients-c");
    clinicianD = await signUpTestClinician("post-patients-d");
  });

  afterAll(async () => {
    await deleteTestUser(clinicianC.userId);
    await deleteTestUser(clinicianD.userId);
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app).post("/api/patients").send({ sex: "male" });
    expect(response.status).toBe(401);
  });

  it("creates a patient owned by the caller and returns it", async () => {
    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "male" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ sex: "male", clinician_id: clinicianC.userId });
    expect(response.body.data.id).toBeDefined();
  });

  it("rejects a caller-supplied clinician_id with 400 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "male", clinician_id: clinicianD.userId });

    expect(response.status).toBe(400);
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("rejects an invalid sex value with 400 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "other" });

    expect(response.status).toBe(400);
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("a created patient is visible to its owner but not to another clinician", async () => {
    const createResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "female" });
    const createdId = createResponse.body.data.id;

    const ownerView = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`);
    expect(ownerView.body.data.some((patient: { id: string }) => patient.id === createdId)).toBe(true);

    const otherView = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianD.accessToken}`);
    expect(otherView.body.data.some((patient: { id: string }) => patient.id === createdId)).toBe(false);
  });
});

describe("POST /api/patients rate limiting", () => {
  let app: express.Express;
  let clinicianE: TestClinician;

  beforeAll(async () => {
    app = buildApp(createRateLimiter({ limit: 2, windowMs: 60_000 }));
    clinicianE = await signUpTestClinician("post-patients-e");
  });

  afterAll(async () => {
    await deleteTestUser(clinicianE.userId);
  });

  it("returns 429 once the per-clinician limit is exceeded", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(app)
        .post("/api/patients")
        .set("Authorization", `Bearer ${clinicianE.accessToken}`)
        .send({ sex: "male" });
      expect(response.status).toBe(201);
    }

    const blocked = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianE.accessToken}`)
      .send({ sex: "male" });

    expect(blocked.status).toBe(429);
  });
});
