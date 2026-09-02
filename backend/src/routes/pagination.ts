const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;

export interface PaginationParams {
  limit: number;
  page: number;
}

export type PaginationResult =
  | { ok: true; params: PaginationParams }
  | { ok: false; error: string };

/**
 * Parses `limit`/`page` query params, applying defaults when absent. A
 * limit above the cap is silently clamped (still a reasonable request);
 * anything non-numeric or less than 1 is rejected outright.
 */
export function parsePagination(query: { limit?: unknown; page?: unknown }): PaginationResult {
  const rawLimit = parsePositiveInt(query.limit);
  if (rawLimit === null) return { ok: false, error: "Invalid value for limit parameter" };

  const rawPage = parsePositiveInt(query.page);
  if (rawPage === null) return { ok: false, error: "Invalid value for page parameter" };

  return {
    ok: true,
    params: {
      limit: Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT),
      page: rawPage ?? DEFAULT_PAGE,
    },
  };
}

/** Returns the parsed integer, `undefined` if absent, or `null` if invalid. */
function parsePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
