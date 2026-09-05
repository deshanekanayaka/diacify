import { Router, type RequestHandler } from "express";

import { createRequestClient } from "../db/requestClient.js";
import { INTERNAL_ERROR_BODY, isUuid } from "./http.js";
import { createPatientSchema } from "./createPatientSchema.js";
import { createVisitSchema } from "./createVisitSchema.js";
import { parsePagination } from "./pagination.js";

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

// The verdict, not the working: a history list wants the category and score
// beside each visit, and the three raw probabilities would trebl the payload
// to say the same thing. POST /predict still returns them.
const LATEST_ASSESSMENT_FIELDS =
  "model_version, risk_score, risk_category, low_confidence, created_at";

/**
 * Reshapes one embedded visit row for the response.
 *
 * PostgREST returns an embedded resource as an array even when limited to
 * one row. That is an artifact of how the data was fetched, not something a
 * caller should have to know, so it becomes a single nullable field - null
 * meaning this visit has never been scored (ADR-028 retired legacy's
 * separate "pending" state in favour of absence).
 */
function toVisitWithLatestAssessment<T extends { risk_assessments: unknown[] }>(row: T) {
  const { risk_assessments: assessments, ...visit } = row;
  return { ...visit, risk_assessment: assessments[0] ?? null };
}

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

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error, count } = await client
      .from("patients")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      res.status(500).json(INTERNAL_ERROR_BODY);
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

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client.from("patients").insert(parsed.data).select().single();

    if (error) {
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    res.status(201).json({ data });
  });

  router.get("/:id/visits", async (req, res) => {
    const patientId = req.params.id;
    if (!isUuid(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const pagination = parsePagination(req.query);
    if (!pagination.ok) {
      res.status(400).json({ error: pagination.error });
      return;
    }
    const { limit, page } = pagination.params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    // RLS behaves differently on read than on write: an unowned patient
    // makes the visits SELECT return zero rows rather than the 42501 the
    // POST path can map to a 404. Without this lookup, "not your patient"
    // and "your patient, no visits yet" would be the same response.
    const { data: patient, error: patientError } = await client
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError) {
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }
    if (!patient) {
      res.status(404).json(PATIENT_NOT_FOUND_BODY);
      return;
    }

    // visit_date is only a date, so same-day visits tie; created_at then id
    // make the order total, which is what keeps pagination stable.
    //
    // The embed is ordered and limited against risk_assessments itself, which
    // PostgREST applies per parent row - so each visit brings back only its
    // most recent assessment, in the same round trip, and a visit scored by
    // an older model version shows the retrained verdict rather than both.
    const { data, error, count } = await client
      .from("visits")
      .select(`*, risk_assessments(${LATEST_ASSESSMENT_FIELDS})`, { count: "exact" })
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("created_at", { ascending: false, referencedTable: "risk_assessments" })
      .limit(1, { referencedTable: "risk_assessments" })
      .range(from, to);

    if (error) {
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    res.status(200).json({ data: data.map(toVisitWithLatestAssessment), page, limit, total: count });
  });

  router.post("/:id/visits", createVisitRateLimit, async (req, res) => {
    const patientId = req.params.id;
    if (!isUuid(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const parsed = createVisitSchema().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid visit data" });
      return;
    }

    const { accessToken } = req.user!;
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
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    res.status(201).json({ data });
  });

  return router;
}
