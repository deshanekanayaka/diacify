import type { NextFunction, Request, Response } from "express";

const TOO_MANY_REQUESTS_BODY = { error: "Too many requests. Please try again shortly." } as const;

export interface RateLimiterOptions {
  /** Maximum requests allowed per key within the window. */
  limit: number;
  /** The rolling window size, in milliseconds. */
  windowMs: number;
  /** Clock override for tests; defaults to Date.now. */
  now?: () => number;
}

/**
 * Builds Express middleware enforcing a true rolling-window rate limit,
 * keyed on the authenticated clinician's id (`req.user.id` - must run
 * after requireAuth). Each key keeps a list of its recent request
 * timestamps; entries older than the window are dropped before counting,
 * so the limit is checked against "requests in the last windowMs", not a
 * fixed calendar bucket that resets all at once.
 *
 * In-memory and per-process: correct for a single backend instance, and
 * resets on restart. Would need a shared store (Postgres/Redis) to stay
 * correct across multiple instances.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const requestTimestampsByKey = new Map<string, number[]>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = req.user!.id;
    const currentTime = now();
    const windowStart = currentTime - windowMs;

    const recentTimestamps = (requestTimestampsByKey.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    // Every key a clinician has ever used stays in the map forever unless
    // removed here - without this, an idle clinician's entry (however
    // small) would never be reclaimed. Still doesn't bound total memory
    // for a clinician who makes exactly one request and never returns
    // (nothing revisits their key to prune it); a periodic sweep would be
    // needed for that, not worth it at Diacify's per-clinic scale.
    if (recentTimestamps.length === 0) {
      requestTimestampsByKey.delete(key);
    }

    if (recentTimestamps.length >= limit) {
      requestTimestampsByKey.set(key, recentTimestamps);
      res.status(429).set("Retry-After", String(Math.ceil(windowMs / 1000))).json(TOO_MANY_REQUESTS_BODY);
      return;
    }

    recentTimestamps.push(currentTime);
    requestTimestampsByKey.set(key, recentTimestamps);
    next();
  };
}
