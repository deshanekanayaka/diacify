import { parseField } from "./queryParam.js";

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
  const rawLimit = parseField(query.limit, parsePositiveInt);
  if (rawLimit === null) return { ok: false, error: "Invalid value for limit parameter" };

  const rawPage = parseField(query.page, parsePositiveInt);
  if (rawPage === null) return { ok: false, error: "Invalid value for page parameter" };

  return {
    ok: true,
    params: {
      limit: Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT),
      page: rawPage ?? DEFAULT_PAGE,
    },
  };
}

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
