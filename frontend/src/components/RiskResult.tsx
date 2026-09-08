import type { RiskAssessment } from "../api/visits";
import "./RiskResult.css";

/** The scored risk verdict, rendered as a dedicated readout rather than an inline tag. */
export function RiskResult({ assessment }: { assessment: RiskAssessment }) {
  return (
    <div className={`risk-result risk-result--${assessment.risk_category}`}>
      <span className="risk-result__category">{assessment.risk_category} risk</span>
      <span className="risk-result__score">Score {assessment.risk_score.toFixed(1)} / 100</span>
      {assessment.low_confidence && (
        <span className="risk-result__confidence">Low-confidence prediction — verify clinically.</span>
      )}
    </div>
  );
}
