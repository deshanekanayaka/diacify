import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.js";
import type { RiskAssessment } from "../ml/riskAssessment.js";

// Postgres unique-violation. On this table it means the visit has already
// been scored by this model version - a repeat, not a failure.
const UNIQUE_VIOLATION = "23505";

// What a caller is shown about a stored assessment: the verdict and which
// model reached it. Probabilities stay out - see ADR-031.
const STORED_ASSESSMENT_FIELDS =
  "model_version, risk_score, risk_category, low_confidence, created_at";

export type StoredAssessment = Pick<
  Database["public"]["Tables"]["risk_assessments"]["Row"],
  "model_version" | "risk_score" | "risk_category" | "low_confidence" | "created_at"
>;

/**
 * Stores an assessment for a visit and returns it as persisted.
 *
 * Returns the stored row rather than the values just computed, so a caller
 * reports what is actually on file - which is the only way created_at can be
 * accurate on a repeat.
 *
 * A collision means this visit was already scored by this model. Scoring is
 * deterministic and the row is immutable (ADR-028), so the existing row holds
 * the same verdict; it is read back and returned rather than treated as an
 * error.
 *
 * @returns The stored assessment, or null if it could not be stored. Never
 *   throws - callers decide whether a failure to record a judgement should
 *   affect the clinical fact it was about.
 */
export async function recordAssessment(
  client: SupabaseClient<Database>,
  visitId: string,
  assessment: RiskAssessment,
): Promise<StoredAssessment | null> {
  const { data, error } = await client
    .from("risk_assessments")
    .insert({
      visit_id: visitId,
      model_version: assessment.model_version,
      probability_low: assessment.probabilities.low,
      probability_medium: assessment.probabilities.medium,
      probability_high: assessment.probabilities.high,
      risk_score: assessment.risk_score,
      risk_category: assessment.risk_category,
      low_confidence: assessment.low_confidence,
    })
    .select(STORED_ASSESSMENT_FIELDS)
    .single();

  if (!error) return data;

  if (error.code === UNIQUE_VIOLATION) {
    const { data: existing } = await client
      .from("risk_assessments")
      .select(STORED_ASSESSMENT_FIELDS)
      .eq("visit_id", visitId)
      .eq("model_version", assessment.model_version)
      .maybeSingle();
    return existing;
  }

  return null;
}
