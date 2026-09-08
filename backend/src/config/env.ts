/** Server configuration read from the environment at process startup. */
export interface Env {
  supabaseUrl: string;
  supabasePublishableKey: string;
  allowedOrigin: string;
}

/**
 * Reads and validates required environment variables. Throws immediately
 * if anything required is missing — intended to be called once at server
 * startup so a misconfigured deploy fails loudly before it starts
 * accepting requests, rather than surfacing as a 500 on the first request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const supabaseUrl = source.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not set");
  }

  const supabasePublishableKey = source.SUPABASE_PUBLISHABLE_KEY;
  if (!supabasePublishableKey) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is not set");
  }

  // ADR-006 put the frontend on its own origin, talking to this API only
  // over CORS - a single configured origin, not a wildcard, since every
  // request already carries a clinician's bearer token.
  const allowedOrigin = source.ALLOWED_ORIGIN;
  if (!allowedOrigin) {
    throw new Error("ALLOWED_ORIGIN is not set");
  }

  return { supabaseUrl, supabasePublishableKey, allowedOrigin };
}
