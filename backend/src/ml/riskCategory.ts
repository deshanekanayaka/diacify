/**
 * Diacify's risk classifications, ordered low to high. This order is also the
 * model's output column order - machine-learning/labels.py::RiskCategory is
 * the training-side counterpart, and serving_export.py writes these same names
 * into the model artifact so the two can be checked against each other.
 */
export const RISK_CATEGORIES = ["low", "medium", "high"] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export type RiskProbabilities = Record<RiskCategory, number>;
