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
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run patients.test.ts. " +
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

function buildApp(rateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 })) {
  const app = express();
  app.use(express.json());
  const requireAuth = createRequireAuth(createSupabaseJwks(supabaseUrl!));
  app.use(
    "/api/patients",
    requireAuth,
    createPatientsRouter({
      supabaseUrl: supabaseUrl!,
      supabasePublishableKey: supabasePublishableKey!,
      createPatientRateLimit: rateLimit,
      createVisitRateLimit: createRateLimiter({ limit: 20, windowMs: 60_000 }),
      model: servingModel,
    }),
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
        .insert({ sex: "female", reference: `Patient ${i}` })
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

  it("carries risk_assessment: null for a patient with no visits", async () => {
    const response = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    expect(response.status).toBe(200);
    for (const patient of response.body.data) {
      expect(patient.risk_assessment).toBeNull();
      expect(patient.visit_count).toBe(0);
      expect(patient.last_visit_date).toBeNull();
    }
  });

  it("carries the patient's latest visit's latest assessment as risk_assessment", async () => {
    const { data: visit, error: visitError } = await clinicianA.client
      .from("visits")
      .insert({
        patient_id: insertedPatientIds[0],
        age: 40,
        systolic: 120,
        diastolic: 80,
        bmi: 25,
        hba1c: 5.5,
      })
      .select()
      .single();
    if (visitError) throw visitError;

    const { error: assessmentError } = await clinicianA.client.from("risk_assessments").insert({
      visit_id: visit.id,
      model_version: "test-model",
      probability_low: 0.7,
      probability_medium: 0.2,
      probability_high: 0.1,
      risk_score: 15,
      risk_category: "low",
      low_confidence: false,
    });
    if (assessmentError) throw assessmentError;

    const response = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${clinicianA.accessToken}`);

    const scored = response.body.data.find((patient: { id: string }) => patient.id === insertedPatientIds[0]);
    expect(scored.risk_assessment).toMatchObject({
      model_version: "test-model",
      risk_category: "low",
      risk_score: 15,
    });
    expect(scored.visit_count).toBe(1);
    expect(scored.last_visit_date).toBe(visit.visit_date);
  });
});

describe("PATCH /api/patients/:id", () => {
  let app: express.Express;
  let clinicianH: TestClinician;
  let clinicianI: TestClinician;
  let ownPatientId: string;
  let otherPatientId: string;

  beforeAll(async () => {
    app = buildApp();
    clinicianH = await signUpTestClinician("patch-patients-h");
    clinicianI = await signUpTestClinician("patch-patients-i");

    const { data: own, error: ownError } = await clinicianH.client
      .from("patients")
      .insert({ sex: "female", reference: "Original" })
      .select()
      .single();
    if (ownError) throw ownError;
    ownPatientId = own.id;

    const { data: other, error: otherError } = await clinicianI.client
      .from("patients")
      .insert({ sex: "male", reference: "Not yours" })
      .select()
      .single();
    if (otherError) throw otherError;
    otherPatientId = other.id;
  });

  afterAll(async () => {
    await deleteTestUser(clinicianH.userId);
    await deleteTestUser(clinicianI.userId);
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app)
      .patch(`/api/patients/${ownPatientId}`)
      .send({ sex: "male", reference: "New" });
    expect(response.status).toBe(401);
  });

  it("updates the caller's own patient and returns it", async () => {
    const response = await request(app)
      .patch(`/api/patients/${ownPatientId}`)
      .set("Authorization", `Bearer ${clinicianH.accessToken}`)
      .send({ sex: "male", reference: "Renamed" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ sex: "male", reference: "Renamed" });
  });

  it("returns 404 for another clinician's patient, and does not change it", async () => {
    const response = await request(app)
      .patch(`/api/patients/${otherPatientId}`)
      .set("Authorization", `Bearer ${clinicianH.accessToken}`)
      .send({ sex: "female", reference: "Hijacked" });

    expect(response.status).toBe(404);

    const stillOriginal = await clinicianI.client.from("patients").select("reference").eq("id", otherPatientId).single();
    expect(stillOriginal.data?.reference).toBe("Not yours");
  });

  it("rejects invalid patient data with 400", async () => {
    const response = await request(app)
      .patch(`/api/patients/${ownPatientId}`)
      .set("Authorization", `Bearer ${clinicianH.accessToken}`)
      .send({ sex: "other", reference: "Renamed" });

    expect(response.status).toBe(400);
  });

  it("rejects renaming to a reference already used by the same clinician, with 409", async () => {
    const { error } = await clinicianH.client.from("patients").insert({ sex: "male", reference: "Taken" });
    if (error) throw error;

    const response = await request(app)
      .patch(`/api/patients/${ownPatientId}`)
      .set("Authorization", `Bearer ${clinicianH.accessToken}`)
      .send({ sex: "male", reference: "Taken" });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/patients/:id", () => {
  let app: express.Express;
  let clinicianJ: TestClinician;
  let clinicianK: TestClinician;

  beforeAll(async () => {
    app = buildApp();
    clinicianJ = await signUpTestClinician("delete-patients-j");
    clinicianK = await signUpTestClinician("delete-patients-k");
  });

  afterAll(async () => {
    await deleteTestUser(clinicianJ.userId);
    await deleteTestUser(clinicianK.userId);
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app).delete("/api/patients/00000000-0000-0000-0000-000000000000");
    expect(response.status).toBe(401);
  });

  it("deletes the caller's own patient, cascading its visits, and returns 204", async () => {
    const { data: patient, error: patientError } = await clinicianJ.client
      .from("patients")
      .insert({ sex: "female", reference: "To delete" })
      .select()
      .single();
    if (patientError) throw patientError;

    const { data: visit, error: visitError } = await clinicianJ.client
      .from("visits")
      .insert({ patient_id: patient.id, age: 30, systolic: 110, diastolic: 70, bmi: 22, hba1c: 5 })
      .select()
      .single();
    if (visitError) throw visitError;

    const response = await request(app)
      .delete(`/api/patients/${patient.id}`)
      .set("Authorization", `Bearer ${clinicianJ.accessToken}`);

    expect(response.status).toBe(204);

    const remainingPatient = await clinicianJ.client.from("patients").select("id").eq("id", patient.id).maybeSingle();
    expect(remainingPatient.data).toBeNull();

    // Deleting a patient must not leave orphaned visits behind - visits.patient_id
    // is `on delete cascade`, so this confirms the cascade actually ran, not
    // just that the patients row is gone.
    const remainingVisit = await clinicianJ.client.from("visits").select("id").eq("id", visit.id).maybeSingle();
    expect(remainingVisit.data).toBeNull();
  });

  it("returns 404 for another clinician's patient, and does not delete it", async () => {
    const { data: patient, error } = await clinicianK.client
      .from("patients")
      .insert({ sex: "male", reference: "Not yours" })
      .select()
      .single();
    if (error) throw error;

    const response = await request(app)
      .delete(`/api/patients/${patient.id}`)
      .set("Authorization", `Bearer ${clinicianJ.accessToken}`);

    expect(response.status).toBe(404);

    const stillThere = await clinicianK.client.from("patients").select("id").eq("id", patient.id).maybeSingle();
    expect(stillThere.data).not.toBeNull();
  });

  it("returns 404 for a well-formed id that doesn't exist", async () => {
    const response = await request(app)
      .delete("/api/patients/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${clinicianJ.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/patients/:id", () => {
  let app: express.Express;
  let clinicianF: TestClinician;
  let clinicianG: TestClinician;
  let patientOwnedByF: string;

  beforeAll(async () => {
    app = buildApp();
    clinicianF = await signUpTestClinician("get-patient-f");
    clinicianG = await signUpTestClinician("get-patient-g");

    const { data, error } = await clinicianF.client
      .from("patients")
      .insert({ sex: "female", reference: "Chart F1" })
      .select()
      .single();
    if (error) throw error;
    patientOwnedByF = data.id;
  });

  afterAll(async () => {
    await deleteTestUser(clinicianF.userId);
    await deleteTestUser(clinicianG.userId);
  });

  it("returns 401 with no Authorization header", async () => {
    const response = await request(app).get(`/api/patients/${patientOwnedByF}`);
    expect(response.status).toBe(401);
  });

  it("returns the caller's own patient", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientOwnedByF}`)
      .set("Authorization", `Bearer ${clinicianF.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: patientOwnedByF, reference: "Chart F1", sex: "female" });
  });

  it("returns 404 for another clinician's patient", async () => {
    const response = await request(app)
      .get(`/api/patients/${patientOwnedByF}`)
      .set("Authorization", `Bearer ${clinicianG.accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Patient not found" });
  });

  it("returns 404 for a well-formed id that matches no patient", async () => {
    const response = await request(app)
      .get("/api/patients/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${clinicianF.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("rejects a malformed id with 400", async () => {
    const response = await request(app)
      .get("/api/patients/not-a-uuid")
      .set("Authorization", `Bearer ${clinicianF.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid patient id" });
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
      .send({ sex: "male", reference: "Chart 1" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      sex: "male",
      reference: "Chart 1",
      clinician_id: clinicianC.userId,
    });
    expect(response.body.data.id).toBeDefined();
  });

  it("rejects a caller-supplied clinician_id with 400 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "male", reference: "Chart 2", clinician_id: clinicianD.userId });

    expect(response.status).toBe(400);
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("rejects an invalid sex value with 400 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "other", reference: "Chart 3" });

    expect(response.status).toBe(400);
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("rejects a missing reference with 400 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "male" });

    expect(response.status).toBe(400);
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("rejects a duplicate reference for the same clinician with 409 and writes nothing", async () => {
    const before = await ownPatientCount(clinicianC);

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "male", reference: "Chart 1" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Reference already in use" });
    expect(await ownPatientCount(clinicianC)).toBe(before);
  });

  it("allows two different clinicians to use the same reference", async () => {
    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianD.accessToken}`)
      .send({ sex: "male", reference: "Chart 1" });

    expect(response.status).toBe(201);
  });

  it("a created patient is visible to its owner but not to another clinician", async () => {
    const createResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianC.accessToken}`)
      .send({ sex: "female", reference: "Chart 4" });
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
        .send({ sex: "male", reference: `Chart ${i}` });
      expect(response.status).toBe(201);
    }

    const blocked = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${clinicianE.accessToken}`)
      .send({ sex: "male", reference: "Chart 2" });

    expect(blocked.status).toBe(429);
  });
});
