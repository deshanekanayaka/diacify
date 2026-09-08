import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePatient } from "../api/patients";
import type { Visit } from "../api/visits";
import { RiskResult } from "../components/RiskResult";
import { VisitForm } from "../components/VisitForm";
import { VisitHistoryList } from "../components/VisitHistoryList";
import { VisitTabStrip, type VisitTab } from "../components/VisitTabStrip";
import "./PatientDetailPage.css";

/** A patient's own screen: History and New Visit as mini chart-tabs of their own. */
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = usePatient(id!);
  const [tab, setTab] = useState<VisitTab>("history");
  const [justRecorded, setJustRecorded] = useState<Visit | null>(null);

  function changeTab(next: VisitTab) {
    setJustRecorded(null);
    setTab(next);
  }

  if (isLoading) {
    return <p>Loading patient…</p>;
  }
  if (isError || !data) {
    return <p role="alert">Couldn't load this patient. Try again.</p>;
  }

  return (
    <div className="patient-detail">
      <Link className="patient-detail__back" to="/">
        ← Patients
      </Link>
      <h1 className="patient-detail__reference">{data.data.reference}</h1>

      <VisitTabStrip active={tab} onChange={changeTab} />

      {tab === "history" && <VisitHistoryList patientId={id!} />}

      {tab === "new-visit" &&
        (justRecorded ? (
          <div className="patient-detail__result">
            {justRecorded.risk_assessment && <RiskResult assessment={justRecorded.risk_assessment} />}
            <div className="patient-detail__result-actions">
              <button type="button" onClick={() => setJustRecorded(null)}>
                Record another visit
              </button>
              <button type="button" onClick={() => changeTab("history")}>
                View in history
              </button>
            </div>
          </div>
        ) : (
          <VisitForm patientId={id!} onRecorded={setJustRecorded} />
        ))}
    </div>
  );
}
