import { Router, type RequestHandler } from "express";

import { createRequestClient } from "../db/requestClient.js";
import { recordAssessment } from "../db/riskAssessments.js";
import { assessRisk } from "../ml/riskAssessment.js";
import type { ServingModel } from "../ml/servingModel.js";
import { INTERNAL_ERROR_BODY, isUuid } from "./http.js";
import { createPatientSchema } from "./createPatientSchema.js";
import { createVisitSchema } from "./createVisitSchema.js";
import { parseDateRange } from "./dateRange.js";
import { parsePagination } from "./pagination.js";
import { logInternalError } from "../internalErrorLog.js";

// The Postgres error code surfaced by PostgREST when an insert is
// rejected because the referenced patient isn't visible/owned by the
// caller. The visits RLS policy's WITH CHECK already requires the patient
// to exist (its EXISTS subquery), so this is the only violation this
// insert can ever actually produce for a bad patient_id - confirmed
// directly against local Postgres: even a patient_id matching no row at
// all surfaces as 42501, not a foreign-key violation, because RLS's
// WITH CHECK is evaluated before the FK constraint gets a chance to run.
const RLS_VIOLATION = "42501";
// Postgres's unique_violation code, raised by idx_patients_clinician_id_reference
// when a clinician reuses a reference on a second patient (migration
// 20260908100000).
const UNIQUE_VIOLATION = "23505";
const PATIENT_NOT_FOUND_BODY = { error: "Patient not found" } as const;
const DUPLICATE_REFERENCE_BODY = { error: "Reference already in use" } as const;

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

/**
 * Reshapes one patient row carrying its visit count and its latest visit's
 * latest assessment.
 *
 * The query embeds `visits` twice under two aliases - `visit_count` (a bare
 * count aggregate) and `latest_visit` (the single most recent visit, itself
 * embedding that visit's single most recent assessment) - because a
 * PostgREST count embed and an order+limited embed of the same relation
 * need separate aliases to carry different modifiers in one request
 * (verified directly against local Postgres). Two nested one-element
 * arrays collapse into one nullable "current risk" field, same reasoning
 * as toVisitWithLatestAssessment one level up - null meaning either no
 * visit yet, or a visit that hasn't been scored.
 *
 * This is the plain embed PostgREST already supports, not the
 * patients_with_latest_risk view that sorting/filtering by risk would need
 * - see context/tasks.md.
 */
function toPatientWithLatestAssessment<
  T extends {
    visit_count: { count: number }[];
    latest_visit: { visit_date: string; risk_assessments: unknown[] }[];
  },
>(row: T) {
  const { visit_count: visitCount, latest_visit: latestVisit, ...patient } = row;
  return {
    ...patient,
    visit_count: visitCount[0]?.count ?? 0,
    last_visit_date: latestVisit[0]?.visit_date ?? null,
    risk_assessment: latestVisit[0]?.risk_assessments[0] ?? null,
  };
}

export interface CreatePatientsRouterOptions {
  supabaseUrl: string;
  supabasePublishableKey: string;
  createPatientRateLimit: RequestHandler;
  createVisitRateLimit: RequestHandler;
  model: ServingModel;
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
  model,
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
      .select(
        `*, visit_count:visits(count), latest_visit:visits(id, visit_date, created_at, risk_assessments(${LATEST_ASSESSMENT_FIELDS}))`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("visit_date", { ascending: false, referencedTable: "latest_visit" })
      .order("created_at", { ascending: false, referencedTable: "latest_visit" })
      .order("id", { ascending: false, referencedTable: "latest_visit" })
      .limit(1, { referencedTable: "latest_visit" })
      .order("created_at", { ascending: false, referencedTable: "latest_visit.risk_assessments" })
      .limit(1, { referencedTable: "latest_visit.risk_assessments" })
      .range(from, to);

    if (error) {
      logInternalError("GET /api/patients", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    res.status(200).json({ data: data.map(toPatientWithLatestAssessment), page, limit, total: count });
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
      if (error.code === UNIQUE_VIOLATION) {
        res.status(409).json(DUPLICATE_REFERENCE_BODY);
        return;
      }
      logInternalError("POST /api/patients", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    res.status(201).json({ data });
  });

  // Same validation and rate limit as creating a patient - editing the same
  // two fields carries the same duplicate-reference and shape rules.
  router.patch("/:id", createPatientRateLimit, async (req, res) => {
    const patientId = req.params.id;
    if (!isUuid(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid patient data" });
      return;
    }

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client
      .from("patients")
      .update(parsed.data)
      .eq("id", patientId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        res.status(409).json(DUPLICATE_REFERENCE_BODY);
        return;
      }
      logInternalError("PATCH /api/patients/:id", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }
    if (!data) {
      res.status(404).json(PATIENT_NOT_FOUND_BODY);
      return;
    }

    res.status(200).json({ data });
  });

  // Hard delete, not an archive/soft-delete: visits and risk_assessments
  // already cascade away with the patient at the database level (see the
  // patients/visits/risk_assessments migrations), so this permanently
  // erases the whole chart. That is a deliberate choice, not an oversight -
  // see the "patient delete" decision recorded when this route was added.
  router.delete("/:id", createPatientRateLimit, async (req, res) => {
    const patientId = req.params.id;
    if (!isUuid(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client
      .from("patients")
      .delete()
      .eq("id", patientId)
      .select("id")
      .maybeSingle();

    if (error) {
      logInternalError("DELETE /api/patients/:id", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }
    if (!data) {
      res.status(404).json(PATIENT_NOT_FOUND_BODY);
      return;
    }

    res.status(204).send();
  });

  router.get("/:id", async (req, res) => {
    const patientId = req.params.id;
    if (!isUuid(patientId)) {
      res.status(400).json({ error: "Invalid patient id" });
      return;
    }

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error } = await client.from("patients").select("*").eq("id", patientId).maybeSingle();

    if (error) {
      logInternalError("GET /api/patients/:id", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }
    if (!data) {
      res.status(404).json(PATIENT_NOT_FOUND_BODY);
      return;
    }

    res.status(200).json({ data });
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
    const rangeFrom = (page - 1) * limit;
    const rangeTo = rangeFrom + limit - 1;

    const dateRange = parseDateRange(req.query);
    if (!dateRange.ok) {
      res.status(400).json({ error: dateRange.error });
      return;
    }
    const { from, to } = dateRange.params;

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
      logInternalError("GET /api/patients/:id/visits — patient lookup", patientError);
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
    let query = client
      .from("visits")
      .select(`*, risk_assessments(${LATEST_ASSESSMENT_FIELDS})`, { count: "exact" })
      .eq("patient_id", patientId);
    if (from !== undefined) query = query.gte("visit_date", from);
    if (to !== undefined) query = query.lte("visit_date", to);

    const { data, error, count } = await query
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("created_at", { ascending: false, referencedTable: "risk_assessments" })
      .limit(1, { referencedTable: "risk_assessments" })
      .range(rangeFrom, rangeTo);

    if (error) {
      logInternalError("GET /api/patients/:id/visits — visits query", error);
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

    // The patient's sex is a model input, so it rides back on the insert
    // rather than costing a second round trip to fetch.
    const { data: created, error } = await client
      .from("visits")
      .insert({ ...parsed.data, patient_id: patientId })
      .select("*, patients(sex)")
      .single();

    if (error) {
      if (error.code === RLS_VIOLATION) {
        res.status(404).json(PATIENT_NOT_FOUND_BODY);
        return;
      }
      logInternalError("POST /api/patients/:id/visits — insert", error);
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    const { patients: patient, ...visit } = created;

    // Scored here so a clinician gets a risk from the one call that records
    // the visit, rather than having to remember a second. Deliberately not
    // bound to the insert: the visit is already committed, and a clinical
    // measurement must not be lost because a judgement about it could not be
    // stored. A failure leaves risk_assessment null and POST /predict can
    // score it later - logged, because a silent null is otherwise invisible.
    const assessment = patient ? assessRisk(model, visit, patient.sex) : null;
    const stored = assessment ? await recordAssessment(client, visit.id, assessment) : null;

    res.status(201).json({ data: { ...visit, risk_assessment: stored } });
  });

  return router;
}
