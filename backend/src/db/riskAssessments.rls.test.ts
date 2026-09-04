import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteTestUser } from "./testCleanup.js";

config({ path: ".env.test" });

/**
 * Proves ownership holds across the project's first three-level chain: a
 * risk assessment belongs to a visit, which belongs to a patient, which
 * belongs to a clinician. Nothing on the row itself names an owner, so
 * every case here depends on the policy's join actually being enforced.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run riskAssessments.rls.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

interface TestClinician {
  client: SupabaseClient;
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
  return { client, userId: data.user!.id };
}

const ASSESSMENT = {
  model_version: "rf-testfixture01",
  probability_low: 0.1,
  probability_medium: 0.3,
  probability_high: 0.6,
  risk_score: 75,
  risk_category: "high" as const,
  low_confidence: false,
};

describe("risk_assessments row level security", () => {
  let clinicianA: TestClinician;
  let clinicianB: TestClinician;
  let anon: SupabaseClient;
  let visitOwnedByA: string;
  let assessmentOwnedByA: string;

  beforeAll(async () => {
    clinicianA = await signUpTestClinician("assessment-a");
    clinicianB = await signUpTestClinician("assessment-b");
    anon = createClient(supabaseUrl!, supabasePublishableKey!);

    const { data: patient, error: patientError } = await clinicianA.client
      .from("patients")
      .insert({ sex: "male" })
      .select()
      .single();
    if (patientError) throw patientError;

    const { data: visit, error: visitError } = await clinicianA.client
      .from("visits")
      .insert({ patient_id: patient.id, age: 50, systolic: 130, diastolic: 85, bmi: 27, hba1c: 6.1 })
      .select()
      .single();
    if (visitError) throw visitError;
    visitOwnedByA = visit.id as string;

    const { data: assessment, error: assessmentError } = await clinicianA.client
      .from("risk_assessments")
      .insert({ ...ASSESSMENT, visit_id: visitOwnedByA })
      .select()
      .single();
    if (assessmentError) throw assessmentError;
    assessmentOwnedByA = assessment.id as string;
  });

  afterAll(async () => {
    // Cascades: user -> patients -> visits -> risk_assessments.
    await deleteTestUser(clinicianA.userId);
    await deleteTestUser(clinicianB.userId);
  });

  it("lets a clinician read an assessment on their own visit", async () => {
    const { data, error } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("id", assessmentOwnedByA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides another clinician's assessment from SELECT", async () => {
    const { data, error } = await clinicianB.client
      .from("risk_assessments")
      .select()
      .eq("id", assessmentOwnedByA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("blocks another clinician from writing an assessment against a visit they don't own", async () => {
    // The write path a read-only policy would miss: clinician B supplies a
    // perfectly valid row, pointing at clinician A's visit.
    const { error } = await clinicianB.client
      .from("risk_assessments")
      .insert({ ...ASSESSMENT, model_version: "rf-intruder", visit_id: visitOwnedByA });
    expect(error).not.toBeNull();

    const { data: assessments } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visitOwnedByA);
    expect(assessments).toHaveLength(1);
  });

  it("refuses an UPDATE from the owning clinician - the record is append-only", async () => {
    // Not an RLS filter but a missing privilege: a stored assessment is what
    // a given model concluded, so there is no legitimate edit to it.
    const { error } = await clinicianA.client
      .from("risk_assessments")
      .update({ risk_category: "low" })
      .eq("id", assessmentOwnedByA);
    expect(error).not.toBeNull();

    const { data: unchanged } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("id", assessmentOwnedByA)
      .single();
    expect(unchanged!.risk_category).toBe("high");
  });

  it("refuses a DELETE from the owning clinician", async () => {
    const { error } = await clinicianA.client
      .from("risk_assessments")
      .delete()
      .eq("id", assessmentOwnedByA);
    expect(error).not.toBeNull();

    const { data: stillThere } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("id", assessmentOwnedByA);
    expect(stillThere).toHaveLength(1);
  });

  it("refuses an UPDATE or DELETE from another clinician too", async () => {
    const { error: updateError } = await clinicianB.client
      .from("risk_assessments")
      .update({ risk_category: "low" })
      .eq("id", assessmentOwnedByA);
    expect(updateError).not.toBeNull();

    const { error: deleteError } = await clinicianB.client
      .from("risk_assessments")
      .delete()
      .eq("id", assessmentOwnedByA);
    expect(deleteError).not.toBeNull();

    const { data: stillThere } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("id", assessmentOwnedByA);
    expect(stillThere).toHaveLength(1);
  });

  it("still removes assessments when the patient is deleted", async () => {
    // Revoking DELETE must not break the cascade: a clinician deleting a
    // patient has to take that patient's assessments with it. Cascades run
    // as a referential-integrity action, not as the caller's own DELETE.
    const { data: patient } = await clinicianA.client
      .from("patients")
      .insert({ sex: "female" })
      .select()
      .single();
    const { data: visit } = await clinicianA.client
      .from("visits")
      .insert({ patient_id: patient!.id, age: 61, systolic: 120, diastolic: 78, bmi: 24, hba1c: 5.2 })
      .select()
      .single();
    const { error: insertError } = await clinicianA.client
      .from("risk_assessments")
      .insert({ ...ASSESSMENT, visit_id: visit!.id });
    expect(insertError).toBeNull();

    const { error: deleteError } = await clinicianA.client
      .from("patients")
      .delete()
      .eq("id", patient!.id);
    expect(deleteError).toBeNull();

    const { data: orphans } = await clinicianA.client
      .from("risk_assessments")
      .select()
      .eq("visit_id", visit!.id);
    expect(orphans).toHaveLength(0);
  });

  it("refuses a second assessment from the same model version for one visit", async () => {
    const { error } = await clinicianA.client
      .from("risk_assessments")
      .insert({ ...ASSESSMENT, visit_id: visitOwnedByA });
    expect(error).not.toBeNull();
  });

  it("accepts a second assessment from a different model version", async () => {
    const { error } = await clinicianA.client
      .from("risk_assessments")
      .insert({ ...ASSESSMENT, model_version: "rf-retrained02", visit_id: visitOwnedByA });
    expect(error).toBeNull();
  });

  it("rejects an unauthenticated request outright (no table grant for anon)", async () => {
    const { data, error } = await anon.from("risk_assessments").select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
