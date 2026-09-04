import { buildFeatureVector, type PatientSex, type VisitMeasurements } from "./features.js";
import { predictProbabilities } from "./forest.js";
import { RISK_CATEGORIES, type RiskCategory, type RiskProbabilities } from "./riskCategory.js";
import type { ServingModel } from "./servingModel.js";

// A ranking number, not a probability: medium risk counts half, high risk
// counts fully, so a list sorted by it puts the most urgent patients first.
const MEDIUM_RISK_WEIGHT = 0.5;
const HIGH_RISK_WEIGHT = 1;
const SCORE_SCALE = 100;

// Two decimal places, matching the precision this score has always been
// reported at. Also absorbs floating-point dust like 55.00000000000001.
const SCORE_ROUNDING_FACTOR = 100;

// With three classes the top probability is always at least 1/3, so a
// threshold below that could never fire - an earlier 0.40 threshold was
// exactly that mistake, advertised but unreachable.
const LOW_CONFIDENCE_THRESHOLD = 0.55;

export interface RiskAssessment {
  probabilities: RiskProbabilities;
  risk_score: number;
  risk_category: RiskCategory;
  low_confidence: boolean;
  model_version: string;
}

/**
 * Scores a visit end to end: measurements in, risk assessment out.
 *
 * @param model The loaded serving model.
 * @param visit The visit's measurements.
 * @param sex The patient's recorded sex.
 * @returns The assessment, stamped with the model version that produced it.
 */
export function assessRisk(
  model: ServingModel,
  visit: VisitMeasurements,
  sex: PatientSex,
): RiskAssessment {
  const features = buildFeatureVector(model, visit, sex);
  const probabilities = toRiskProbabilities(model, predictProbabilities(model, features));

  return {
    probabilities,
    risk_score: calculateRiskScore(probabilities),
    risk_category: classifyRisk(probabilities),
    low_confidence: isLowConfidence(probabilities),
    model_version: model.version,
  };
}

/**
 * Collapses the probabilities into a single 0-100 number for ranking patients.
 *
 * Deliberately not the source of the risk category: see classifyRisk.
 *
 * @param probabilities One probability per risk category.
 */
export function calculateRiskScore(probabilities: RiskProbabilities): number {
  const weighted =
    MEDIUM_RISK_WEIGHT * probabilities.medium + HIGH_RISK_WEIGHT * probabilities.high;
  return Math.round(weighted * SCORE_SCALE * SCORE_ROUNDING_FACTOR) / SCORE_ROUNDING_FACTOR;
}

/**
 * Picks the risk category the model considers most likely.
 *
 * Read from the probabilities directly, never by banding the risk score. The
 * two answer different questions - "how should this patient rank against
 * others" versus "what is this patient" - and deriving one from the other has
 * previously inverted prioritised lists, putting a confidently-low patient
 * above a borderline-medium one.
 *
 * @param probabilities One probability per risk category.
 */
export function classifyRisk(probabilities: RiskProbabilities): RiskCategory {
  let mostLikely: RiskCategory = RISK_CATEGORIES[0];
  for (const category of RISK_CATEGORIES) {
    if (probabilities[category] > probabilities[mostLikely]) mostLikely = category;
  }
  return mostLikely;
}

/**
 * Reports whether the model was unsure enough that a clinician should not
 * read the category as settled.
 *
 * @param probabilities One probability per risk category.
 */
export function isLowConfidence(probabilities: RiskProbabilities): boolean {
  return Math.max(...RISK_CATEGORIES.map((category) => probabilities[category]))
    < LOW_CONFIDENCE_THRESHOLD;
}

/** Labels the forest's positional output with the categories the model declares. */
function toRiskProbabilities(model: ServingModel, predicted: number[]): RiskProbabilities {
  const probabilities = {} as RiskProbabilities;
  for (const [index, category] of model.classes.entries()) {
    probabilities[category] = predicted[index]!;
  }
  return probabilities;
}
