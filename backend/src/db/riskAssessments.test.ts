import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadDefaultServingModel } from "../ml/servingModel.js";
import { assessRisk } from "../ml/riskAssessment.js";
import type { Database } from "./database.types.js";
import { recordAssessment } from "./riskAssessments.js";
import { deleteTestUser } from "./testCleanup.js";

config({ path: ".env.test" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run riskAssessments.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

const model = loadDefaultServingModel();
const assessment = assessRisk(
  model,
  { age: 45, systolic: 128, diastolic: 82, bmi: 27, hba1c: 5.8,
    rbs: null, triglycerides: null, hdl: null, ldl: null },
  "male",
);

describe("recordAssessment", () => {
  let client: SupabaseClient<Database>;
  let userId: string;
  let visitId: string;

  beforeAll(async () => {
    const anon = createClient<Database>(supabaseUrl!, supabasePublishableKey!);
    const { data, error } = await anon.auth.signUp({
      email: `record-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      password: "correct horse battery staple",
    });
    if (error) throw error;
    client = anon;
    userId = data.user!.id;

    const { data: patient } = await client
      .from("patients").insert({ sex: "male" }).select().single();
    const { data: visit } = await client
      .from("visits")
      .insert({ patient_id: patient!.id, age: 45, systolic: 128, diastolic: 82, bmi: 27, hba1c: 5.8 })
      .select()
      .single();
    visitId = visit!.id;
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("stores an assessment and returns it as persisted", async () => {
    const stored = await recordAssessment(client, visitId, assessment);
    expect(stored).not.toBeNull();
    expect(stored!.model_version).toBe(assessment.model_version);
    expect(Number(stored!.risk_score)).toBe(assessment.risk_score);
    expect(typeof stored!.created_at).toBe("string");
  });

  it("returns the already-stored row on a repeat, keeping its original timestamp", async () => {
    const first = await recordAssessment(client, visitId, assessment);
    const second = await recordAssessment(client, visitId, assessment);
    expect(second).toEqual(first);
  });

  it("returns null rather than throwing when the visit does not exist", async () => {
    // A visit outside this clinician's reach is refused by RLS. The caller
    // has to be able to decide what that means, so this resolves to null
    // instead of raising.
    const stored = await recordAssessment(
      client,
      "00000000-0000-4000-8000-000000000000",
      assessment,
    );
    expect(stored).toBeNull();
  });
});
