import { createClient } from "@supabase/supabase-js";

import { env } from "./env";

/**
 * ADR-039: the frontend uses the Supabase JS client for auth only (sign-in +
 * session), with its default persisted (localStorage) storage. It owns
 * token refresh; callers read `supabase.auth.getSession()` for the current
 * access token rather than tracking it themselves.
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey);
