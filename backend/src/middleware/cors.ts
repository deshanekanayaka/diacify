import type { RequestHandler } from "express";

/**
 * Allows exactly one configured origin (ADR-006's frontend, on its own
 * origin from the API) rather than reflecting every caller or using a
 * wildcard - every request already carries a clinician's bearer token, so
 * an open CORS policy would let any page read a signed-in clinician's data
 * via their browser session.
 *
 * Handles the browser's OPTIONS preflight directly (204, no body) since
 * nothing downstream needs to see it; a real GET/POST still reaches the
 * route with the CORS headers attached to its own response.
 */
export function createCors(allowedOrigin: string): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).end();
      return;
    }

    next();
  };
}
