import { Link, useNavigate, useParams } from "react-router-dom";

import { usePatient } from "../api/patients";
import { useVisits, type RiskAssessment, type Visit } from "../api/visits";
import { DeletePatientButton } from "../components/DeletePatientButton";
import { RiskBadge } from "../components/RiskBadge";
import { formatDate, formatScore } from "../lib/format";

/**
 * One patient's chart: their current risk, and every visit behind it.
 *
 * "Current risk" is the newest visit's assessment, not a separately stored
 * field — visits come back newest first, so the first row is the current one.
 */
export function PatientDetailPage() {
  const { id } = useParams();
  const patientId = id!;
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const visits = useVisits(patientId);

  if (patient.isPending) {
    return <p className="placeholder">Loading patient…</p>;
  }
  if (patient.isError) {
    return (
      <div className="page">
        <p className="banner banner--error" role="alert">
          {patient.error.message}
        </p>
      </div>
    );
  }

  const rows = visits.data?.data ?? [];
  const latest = rows[0];

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ‹ Patients
      </Link>

      <div className="row row--between" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="t-title t-num">{patient.data.data.reference}</h1>
          <p className="t-caption" style={{ textTransform: "capitalize" }}>
            {patient.data.data.sex} · {rows.length} {rows.length === 1 ? "visit" : "visits"}
          </p>
        </div>
        <div className="row">
          <Link to={`/patients/${patientId}/visits/new`} className="btn">
            Record visit
          </Link>
          <Link to={`/patients/${patientId}/edit`} className="btn btn--secondary">
            Edit
          </Link>
          <DeletePatientButton
            patientId={patientId}
            reference={patient.data.data.reference}
            className="btn btn--danger"
            onDeleted={() => navigate("/")}
          />
        </div>
      </div>

      {latest?.risk_assessment ? (
        <RiskVerdict assessment={latest.risk_assessment} visitDate={latest.visit_date} />
      ) : null}

      <h2 className="t-label" style={{ margin: "2rem 0 0.75rem" }}>
        Visit history
      </h2>

      {visits.isPending ? <p className="placeholder">Loading visits…</p> : null}
      {visits.isError ? (
        <p className="banner banner--error" role="alert">
          {visits.error.message}
        </p>
      ) : null}
      {visits.data && rows.length === 0 ? (
        <div className="card placeholder">
          <p className="t-body">No visits recorded yet.</p>
        </div>
      ) : null}
      {rows.length > 0 ? <VisitTable visits={rows} /> : null}
    </div>
  );
}

/** The headline answer: category, score, and which model version said so. */
function RiskVerdict({ assessment, visitDate }: { assessment: RiskAssessment; visitDate: string }) {
  return (
    <section className={`card verdict verdict--${assessment.risk_category}`}>
      <div style={{ flex: 1, minWidth: "min(100%, 260px)" }}>
        <p className="t-label">Current risk</p>
        <p className="verdict__category">{assessment.risk_category}</p>
        <p className="t-body t-num">{formatScore(assessment.risk_score)} out of 100</p>
        <div className="verdict__meter">
          <span style={{ width: `${assessment.risk_score}%` }} />
        </div>
        {assessment.low_confidence ? (
          <p className="t-caption" style={{ marginTop: "0.75rem" }}>
            The model was not confident in this classification — treat it as a weak signal.
          </p>
        ) : null}
      </div>
      <div style={{ textAlign: "right" }}>
        <p className="t-caption">Recorded {formatDate(visitDate)}</p>
        <p className="t-caption t-num">{assessment.model_version}</p>
      </div>
    </section>
  );
}

/** Every recorded visit, newest first, with the measurements behind each score. */
function VisitTable({ visits }: { visits: Visit[] }) {
  return (
    <div className="card card--flush table-scroll">
      <table className="data">
        <thead>
          <tr>
            <th>Visit date</th>
            <th>Age</th>
            <th>BP</th>
            <th>BMI</th>
            <th>HbA1c</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td>{formatDate(visit.visit_date)}</td>
              <td className="t-num">{visit.age}</td>
              <td className="t-num">
                {visit.systolic}/{visit.diastolic}
              </td>
              <td className="t-num">{visit.bmi}</td>
              <td className="t-num">{visit.hba1c}</td>
              <td>
                <RiskBadge assessment={visit.risk_assessment} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
