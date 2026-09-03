import { Router, type RequestHandler } from "express";

import { createRequestClient } from "../db/requestClient.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { createPatientSchema } from "./createPatientSchema.js";
import { createVisitSchema } from "./createVisitSchema.js";
import { parsePagination } from "./pagination.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Postgres error code surfaced by PostgREST when an insert is
// rejected because the referenced patient isn't visible/owned by the
// caller. The visits RLS policy's WITH CHECK already requires the patient
// to exist (its EXISTS subquery), so this is the only violation this
// insert can ever actually produce for a bad patient_id - confirmed
// directly against local Postgres: even a patient_id matching no row at
// all surfaces as 42501, not a foreign-key violation, because RLS's
// WITH CHECK is evaluated before the FK constraint gets a chance to run.
const RLS_VIOLATION = "42501";
const PATIENT_NOT_FOUND_BODY = { error: "Patient not found" } as const;

export interface CreatePatientsRouterOptions {
  supabaseUrl: string;
  supabasePublishableKey: string;
  createPatientRateLimit: RequestHandler;
  createVisitRateLimit: RequestHandler;
}

/**
 * Patient routes. RLS scopes every query to the caller — this router
 * never filters by clinician_id itself, since a request-scoped client
 * (built from the caller's own verified JWT) can only ever see rows
 * Postgres already decided belong to them.
 */
export function createPatientsRouter({
  supabaseUrl,
  supabasePublishableKey,
  createPatientRateLimit,
  createVisitRateLimit,
}: CreatePatientsRouterOptions): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination.ok) {
      res.status(400).json({ error: pagination.error });
      return;
    }
    const { limit, page } = pagination.params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { accessToken } = (req as AuthenticatedRequest).user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error, count } = await client
      .from("patients")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      res.status(500).json({ error: "Something went wrong. Please try again." });
      return;
    }

    res.status(200).json({ data, page, limit, total: count });
  });

  router.post("/", createPatientRateLimit, async (req, res) => {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid patient data" });
      return;
    }

    const { accessToken } = (req as AuthenticatedRequest).user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client.from("patients").insert(parsed.data).select().single();

    if (error) {
      res.status(500).json({ error: "Something went wrong. Please try again." });
      return;
    }

    res.status(201).json({ data });
  });

  router.post("/:id/visits", createVisitRateLimit, async (req, res) => {
    const patientId = req.params.id;
    if (!patientId || !UUID_PATTERN.test(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const parsed = createVisitSchema().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid visit data" });
      return;
    }

    const { accessToken } = (req as AuthenticatedRequest).user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client
      .from("visits")
      .insert({ ...parsed.data, patient_id: patientId })
      .select()
      .single();

    if (error) {
      if (error.code === RLS_VIOLATION) {
        res.status(404).json(PATIENT_NOT_FOUND_BODY);
        return;
      }
      res.status(500).json({ error: "Something went wrong. Please try again." });
      return;
    }

    res.status(201).json({ data });
  });

  return router;
}
