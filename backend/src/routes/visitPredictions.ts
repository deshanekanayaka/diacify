import { Router } from "express";

import { createRequestClient } from "../db/requestClient.js";
import { assessRisk } from "../ml/riskAssessment.js";
import type { ServingModel } from "../ml/servingModel.js";
import { INTERNAL_ERROR_BODY, isUuid } from "./http.js";

const VISIT_NOT_FOUND_BODY = { error: "Visit not found" } as const;

export interface CreateVisitPredictionsRouterOptions {
  supabaseUrl: string;
  supabasePublishableKey: string;
  model: ServingModel;
}

/**
 * Risk scoring for a recorded visit, mounted at /api/visits.
 *
 * Scores a visit already on file rather than a payload from the request
 * body: the measurements were validated when they were written, and reading
 * them back means RLS decides whether this caller may score them at all.
 *
 * Computes only - nothing is written. The assessment is deterministic for a
 * given visit and model, so calling it twice is safe and returns the same
 * answer.
 */
export function createVisitPredictionsRouter({
  supabaseUrl,
  supabasePublishableKey,
  model,
}: CreateVisitPredictionsRouterOptions): Router {
  const router = Router();

  router.post("/:id/predict", async (req, res) => {
    const visitId = req.params.id;
    if (!isUuid(visitId)) {
      res.status(400).json({ error: "Invalid visit id" });
      return;
    }

    const { accessToken } = req.user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    // The patient's sex is a model input, and the embed rides along on the
    // visits policy - a visit the caller can't see returns no row at all,
    // which is the same 404 whether it is missing or simply not theirs.
    const { data: visit, error } = await client
      .from("visits")
      .select(
        "id, age, systolic, diastolic, bmi, hba1c, rbs, triglycerides, hdl, ldl, patients(sex)",
      )
      .eq("id", visitId)
      .maybeSingle();

    if (error) {
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }
    if (!visit) {
      res.status(404).json(VISIT_NOT_FOUND_BODY);
      return;
    }
    if (!visit.patients) {
      // patient_id is NOT NULL with a foreign key, so this is unreachable
      // short of the embed itself failing - reported rather than assumed away.
      res.status(500).json(INTERNAL_ERROR_BODY);
      return;
    }

    const assessment = assessRisk(model, visit, visit.patients.sex);
    res.status(200).json({ data: { visit_id: visit.id, ...assessment } });
  });

  return router;
}
