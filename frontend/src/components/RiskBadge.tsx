import type { RiskAssessment } from "../api/visits";
import { formatScore } from "../lib/format";

/** The compact risk read used in lists and tables: category pill plus score. */
export function RiskBadge({ assessment }: { assessment: RiskAssessment | null }) {
  if (!assessment) {
    return <span className="pill">Not scored</span>;
  }

  return (
    <span className="row" style={{ gap: "0.5rem" }}>
      <span className={`pill pill--${assessment.risk_category}`}>
        <span className="dot" aria-hidden="true" />
        {assessment.risk_category}
      </span>
      <span className="t-num t-caption">{formatScore(assessment.risk_score)}</span>
    </span>
  );
}
