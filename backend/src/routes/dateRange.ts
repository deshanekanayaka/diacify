import { parseField } from "./queryParam.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRangeParams {
  from?: string;
  to?: string;
}

export type DateRangeResult =
  | { ok: true; params: DateRangeParams }
  | { ok: false; error: string };

/**
 * Parses `from`/`to` query params bounding `visit_date`. Both are optional
 * and independent; absent means unfiltered on that side. Format is a plain
 * YYYY-MM-DD string, matched by regex rather than a schema library - the
 * value passes straight through to a Postgres `date` column comparison, so
 * no further parsing is needed.
 */
export function parseDateRange(query: { from?: unknown; to?: unknown }): DateRangeResult {
  const from = parseField(query.from, (raw) => (DATE_PATTERN.test(raw) ? raw : null));
  if (from === null) return { ok: false, error: "Invalid value for from parameter" };

  const to = parseField(query.to, (raw) => (DATE_PATTERN.test(raw) ? raw : null));
  if (to === null) return { ok: false, error: "Invalid value for to parameter" };

  if (from !== undefined && to !== undefined && from > to) {
    return { ok: false, error: "from must not be after to" };
  }

  const params: DateRangeParams = {};
  if (from !== undefined) params.from = from;
  if (to !== undefined) params.to = to;
  return { ok: true, params };
}
