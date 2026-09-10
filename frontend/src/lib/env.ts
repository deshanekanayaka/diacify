/** Reads a required Vite env var, throwing at startup rather than failing silently later. */
function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv("VITE_SUPABASE_URL"),
  supabasePublishableKey: requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  apiBaseUrl: requireEnv("VITE_API_BASE_URL"),
};
