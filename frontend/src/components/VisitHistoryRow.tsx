import { useState } from "react";

import type { Visit } from "../api/visits";
import "./VisitHistoryRow.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const DETAIL_FIELDS: { key: keyof Visit; label: string; unit: string }[] = [
  { key: "age", label: "Age", unit: "years" },
  { key: "systolic", label: "Systolic BP", unit: "mmHg" },
  { key: "diastolic", label: "Diastolic BP", unit: "mmHg" },
  { key: "bmi", label: "BMI", unit: "kg/m²" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "rbs", label: "Random blood sugar", unit: "mg/dL" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg/dL" },
  { key: "triglycerides", label: "Triglycerides", unit: "mg/dL" },
  { key: "hdl", label: "HDL", unit: "mg/dL" },
  { key: "ldl", label: "LDL", unit: "mg/dL" },
  { key: "vldl", label: "VLDL", unit: "mg/dL" },
];

/** One past visit, closed to a compact tab; opens in place to show its full vitals and result. */
export function VisitHistoryRow({ visit }: { visit: Visit }) {
  const [open, setOpen] = useState(false);
  const category = visit.risk_assessment?.risk_category;

  return (
    <li className={`visit-history-row visit-history-row--${category ?? "unscored"}`}>
      <button type="button" className="visit-history-row__summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="visit-history-row__date">{formatDate(visit.visit_date)}</span>
        <span className="visit-history-row__badge">{category ?? "not scored"}</span>
      </button>

      {open && (
        <dl className="visit-history-row__detail">
          {DETAIL_FIELDS.map(
            (field) =>
              visit[field.key] !== null && (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    {visit[field.key] as number} {field.unit}
                  </dd>
                </div>
              ),
          )}
          {visit.risk_assessment && (
            <div>
              <dt>Risk score</dt>
              <dd>{visit.risk_assessment.risk_score.toFixed(1)} / 100</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
