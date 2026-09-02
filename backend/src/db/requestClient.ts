import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.js";

/**
 * Builds a Supabase client scoped to one request's caller. Every query
 * through it runs as the `authenticated` Postgres role with `auth.uid()`
 * resolving from `accessToken` — RLS enforces ownership the same way it
 * does for a direct client, so route handlers never need to re-derive or
 * pass clinician_id themselves.
 *
 * Typed against `database.types.ts` (generated with `supabase gen types
 * typescript --linked > src/db/database.types.ts`, regenerate after any
 * migration) so `.from("patients")` and column names are checked at
 * compile time instead of trusting a string.
 */
export function createRequestClient(
  supabaseUrl: string,
  supabasePublishableKey: string,
  accessToken: string,
): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
