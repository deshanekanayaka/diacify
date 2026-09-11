import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

// jose's default is 5s. A cold host's first outbound request (DNS, TLS,
// everything uninitialized) can plausibly run past that on its own, before
// Supabase is even asked anything - widened so a slow boot doesn't get
// mistaken for the signing service being down (ADR-033's JWKSTimeout - 503
// branch).
const JWKS_FETCH_TIMEOUT_MS = 10_000;

/**
 * Builds a cached resolver for Supabase's asymmetric JWT signing keys.
 * `jose` fetches and caches the JWKS response itself (Supabase's edge
 * caches it for 10 minutes), so this never hits the network per request
 * in the common case.
 */
export function createSupabaseJwks(supabaseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl), {
    timeoutDuration: JWKS_FETCH_TIMEOUT_MS,
  });
}
