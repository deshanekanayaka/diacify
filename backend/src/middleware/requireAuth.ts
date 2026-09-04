import type { NextFunction, Request, Response } from "express";
import { errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from "jose";

const UNAUTHORIZED_BODY = { error: "Missing or invalid authorization token" } as const;
const SERVICE_UNAVAILABLE_BODY = { error: "Something went wrong. Please try again." } as const;

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Builds Express middleware that verifies a Supabase-issued JWT locally
 * (against `getKey`, e.g. a cached JWKS) and attaches the clinician's id
 * to `req.user`. Distinguishes an unauthenticated caller (401) from the
 * signing key being unreachable (503) — a wrong/expired token is not the
 * same failure as the verification service itself being down.
 */
export function createRequireAuth(getKey: JWTVerifyGetKey) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = extractBearerToken(req.header("authorization"));
    if (!token) {
      res.status(401).json(UNAUTHORIZED_BODY);
      return;
    }

    try {
      const { payload } = await jwtVerify(token, getKey);
      if (typeof payload.sub !== "string") {
        res.status(401).json(UNAUTHORIZED_BODY);
        return;
      }
      req.user = { id: payload.sub, accessToken: token };
      next();
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        res.status(401).json(UNAUTHORIZED_BODY);
        return;
      }
      res.status(503).json(SERVICE_UNAVAILABLE_BODY);
    }
  };
}
