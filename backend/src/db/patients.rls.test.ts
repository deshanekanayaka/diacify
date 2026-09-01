import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.test" });

/**
 * Proves Postgres RLS actually enforces patient ownership — not just that
 * the policy exists, but that a second clinician genuinely cannot read,
 * update, or delete a patient they don't own. Runs against the local
 * Supabase stack (`supabase start`), which auto-confirms signups so real
 * clinician accounts can be created inline without any manual step or a
 * service_role key.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set to run patients.rls.test.ts. " +
      "Run `supabase start` and point these at the local stack (see backend/.env.test.example).",
  );
}

async function signUpTestClinician(label: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, supabasePublishableKey!);
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const { error } = await client.auth.signUp({ email, password: "correct horse battery staple" });
  if (error) throw error;
  return client;
}

describe("patients row level security", () => {
  let clinicianA: SupabaseClient;
  let clinicianB: SupabaseClient;
  let anon: SupabaseClient;
  let patientOwnedByA: string;

  beforeAll(async () => {
    clinicianA = await signUpTestClinician("clinician-a");
    clinicianB = await signUpTestClinician("clinician-b");
    anon = createClient(supabaseUrl!, supabasePublishableKey!);

    const { data, error } = await clinicianA.from("patients").insert({}).select().single();
    if (error) throw error;
    patientOwnedByA = data.id as string;
  });

  it("lets a clinician read their own patient", async () => {
    const { data, error } = await clinicianA.from("patients").select().eq("id", patientOwnedByA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides another clinician's patient from SELECT", async () => {
    const { data, error } = await clinicianB.from("patients").select().eq("id", patientOwnedByA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("blocks another clinician's UPDATE (RLS filters the row, not an error)", async () => {
    const { data, error } = await clinicianB
      .from("patients")
      .update({})
      .eq("id", patientOwnedByA)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: unchanged } = await clinicianA.from("patients").select().eq("id", patientOwnedByA);
    expect(unchanged).toHaveLength(1);
  });

  it("blocks another clinician's DELETE", async () => {
    const { error } = await clinicianB.from("patients").delete().eq("id", patientOwnedByA);
    expect(error).toBeNull();

    const { data: stillThere } = await clinicianA.from("patients").select().eq("id", patientOwnedByA);
    expect(stillThere).toHaveLength(1);
  });

  it("rejects an unauthenticated request outright (no table grant for anon)", async () => {
    const { data, error } = await anon.from("patients").select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
