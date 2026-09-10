import { RISK_CATEGORIES } from "../ml/riskCategory.js";

// "unscored" alongside the model's own categories - a patient with no
// scored visit yet is a real, distinct filter bucket on the patient list,
// not a fourth risk category the model produces.
const RISK_FILTER_VALUES = [...RISK_CATEGORIES, "unscored"] as const;
export type RiskFilter = (typeof RISK_FILTER_VALUES)[number];

const SORT_VALUES = ["newest", "risk"] as const;
export type PatientSort = (typeof SORT_VALUES)[number];

export interface PatientRiskQueryParams {
  risk?: RiskFilter;
  sort: PatientSort;
}

export type PatientRiskQueryResult =
  | { ok: true; params: PatientRiskQueryParams }
  | { ok: false; error: string };

/**
 * Parses the `risk`/`sort` query params GET /api/patients filters and
 * orders by, backed by the patients_with_latest_risk view. Both optional;
 * `sort` defaults to "newest" (the view's created_at, same as the plain
 * patients table's default order).
 */
export function parsePatientRiskQuery(query: { risk?: unknown; sort?: unknown }): PatientRiskQueryResult {
  const risk = parseEnumParam(query.risk, RISK_FILTER_VALUES);
  if (risk === null) return { ok: false, error: "Invalid value for risk parameter" };

  const sort = parseEnumParam(query.sort, SORT_VALUES);
  if (sort === null) return { ok: false, error: "Invalid value for sort parameter" };

  const params: PatientRiskQueryParams = { sort: sort ?? "newest" };
  if (risk !== undefined) params.risk = risk;
  return { ok: true, params };
}

/** Returns the value if it's one of `values`, `undefined` if absent, or `null` if invalid. */
function parseEnumParam<T extends string>(value: unknown, values: readonly T[]): T | null | undefined {
  if (value === undefined) return undefined;
  return (values as readonly string[]).includes(value as string) ? (value as T) : null;
}
