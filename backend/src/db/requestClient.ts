import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds a Supabase client scoped to one request's caller. Every query
 * through it runs as the `authenticated` Postgres role with `auth.uid()`
 * resolving from `accessToken` — RLS enforces ownership the same way it
 * does for a direct client, so route handlers never need to re-derive or
 * pass clinician_id themselves.
 */
export function createRequestClient(
  supabaseUrl: string,
  supabasePublishableKey: string,
  accessToken: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
