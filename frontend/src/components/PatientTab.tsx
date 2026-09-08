import type { Patient } from "../api/patients";
import "./PatientTab.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** One patient's chart tab: reference label and created date, in the chart-binder tab shape. */
export function PatientTab({ patient }: { patient: Patient }) {
  return (
    <li className="patient-tab">
      <span className="patient-tab__reference">{patient.reference}</span>
      <span className="patient-tab__date">{formatDate(patient.created_at)}</span>
    </li>
  );
}
