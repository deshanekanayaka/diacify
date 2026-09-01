/** Server configuration read from the environment at process startup. */
export interface Env {
  supabaseUrl: string;
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
  return { supabaseUrl };
}
