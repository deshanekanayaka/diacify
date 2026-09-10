const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats an ISO date (or timestamp) as "6 Sep 2026" for display.
 *
 * A bare "YYYY-MM-DD" string (visit_date, last_visit_date - Postgres `date`
 * columns) is parsed as local midnight, not `new Date(iso)`'s UTC midnight:
 * rendering UTC midnight in any timezone behind UTC shows the day before the
 * one actually recorded. A full timestamp (created_at) already carries its
 * own offset, so it parses as-is.
 */
export function formatDate(iso: string): string {
  const date = DATE_ONLY_PATTERN.test(iso) ? parseDateOnlyAsLocal(iso) : new Date(iso);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseDateOnlyAsLocal(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The risk score to the one decimal a clinician reads at a glance. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
