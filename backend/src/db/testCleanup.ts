import { createClient } from "@supabase/supabase-js";

/**
 * Deletes a test user created against the local Supabase stack, via the
 * admin API. `clinician_id` cascades on delete, so this also removes
 * every patient row the user owned — no separate cleanup needed.
 *
 * Test-only: relies on SUPABASE_SECRET_KEY, which must only ever be set
 * in .env.test, pointing at the local stack (127.0.0.1). Never wire this
 * against the real project.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set to clean up test users.");
  }

  const admin = createClient(supabaseUrl, secretKey);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
