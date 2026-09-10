import type { RiskCategory } from "../api/visits";

/** Formats an ISO date (or timestamp) as "6 Sep 2026" for display. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The risk score to the one decimal a clinician reads at a glance. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/** Maps a risk category to its CSS modifier suffix, so colour lives in CSS. */
export function riskModifier(category: RiskCategory): string {
  return category;
}
