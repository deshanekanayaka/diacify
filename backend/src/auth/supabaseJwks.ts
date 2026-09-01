import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

/**
 * Builds a cached resolver for Supabase's asymmetric JWT signing keys.
 * `jose` fetches and caches the JWKS response itself (Supabase's edge
 * caches it for 10 minutes), so this never hits the network per request
 * in the common case.
 */
export function createSupabaseJwks(supabaseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl));
}
