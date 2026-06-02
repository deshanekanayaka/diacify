import { clerkMiddleware, getAuth } from '@clerk/express';

export const globalClerkMiddleware = clerkMiddleware;

/**
 * requireClerkAuth
 *
 * Route-level middleware. Apply to any route group that requires
 * a verified Clerk session.
 *
 * On success:
 *   - Sets req.auth.userId to the verified Clerk user ID
 *   - Calls next() — request proceeds to route handler
 *
 * On failure (missing token, expired token, tampered token):
 *   - Returns 401 JSON — never redirects
 *   - Request stops here, route handler is never reached
 *
 * On Clerk service unavailability:
 *   - Returns 503 JSON with a specific message
 *   - Distinguishes auth outage from invalid credentials
 */
export const requireClerkAuth = (req, res, next) => {
  try {
    const auth = getAuth(req);

    // getAuth() returns an auth object. If clerkMiddleware() could not
    // verify a session, userId will be null.
    if (!auth || !auth.userId) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: 'A valid Clerk session token is required. Include it in the Authorization: Bearer <token> header.',
      });
    }

    // Attach the verified userId to req.auth so route handlers can
    // access it without calling getAuth() again.
    // This is the ONLY source of clerk_id used in DB queries.
    req.auth = {
      userId: auth.userId,
      sessionId: auth.sessionId,
    };

    return next();

  } catch (err) {
    // Clerk SDK throws if CLERK_SECRET_KEY is missing or if Clerk's
    // verification service is unreachable.
    if (err.message && err.message.includes('CLERK_SECRET_KEY')) {
      return res.status(500).json({
        error: 'Server misconfiguration',
        message: 'CLERK_SECRET_KEY environment variable is not set.',
      });
    }

    // Any other Clerk error — treat as auth service unavailable
    return res.status(503).json({
      error: 'Authentication service unavailable',
      message: 'Unable to verify session. Please try again shortly.',
    });
  }
};