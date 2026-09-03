import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";

import { createSupabaseJwks } from "./auth/supabaseJwks.js";
import { loadEnv } from "./config/env.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { createRequireAuth } from "./middleware/requireAuth.js";
import { createPatientsRouter } from "./routes/patients.js";

// 20 writes per clinician per rolling minute - generous for a human
// entering patients (or visits) by hand, tight enough to stop a runaway
// client loop or a stolen token from flooding writes. Separate limiter
// instances per route: creating a patient and adding a visit are
// different actions, so they get independent budgets rather than
// competing for one shared count.
const CREATE_PATIENT_LIMIT = 20;
const CREATE_PATIENT_WINDOW_MS = 60_000;
const CREATE_VISIT_LIMIT = 20;
const CREATE_VISIT_WINDOW_MS = 60_000;

const env = loadEnv();
const requireAuth = createRequireAuth(createSupabaseJwks(env.supabaseUrl));
const createPatientRateLimit = createRateLimiter({
  limit: CREATE_PATIENT_LIMIT,
  windowMs: CREATE_PATIENT_WINDOW_MS,
});
const createVisitRateLimit = createRateLimiter({
  limit: CREATE_VISIT_LIMIT,
  windowMs: CREATE_VISIT_WINDOW_MS,
});

const app = express();
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(
  "/api/patients",
  requireAuth,
  createPatientsRouter({
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabasePublishableKey,
    createPatientRateLimit,
    createVisitRateLimit,
  }),
);

// express.json() rejects malformed JSON bodies by calling next(err) -
// without this handler, Express's default error page returns HTML
// instead of the { error } shape every other route uses.
const handleJsonParseError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }
  next(err);
};
app.use(handleJsonParseError);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`diacify backend listening on port ${port}`);
});
