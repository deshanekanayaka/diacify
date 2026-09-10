import { Link, useNavigate, useParams } from "react-router-dom";

import { usePatient, useUpdatePatient } from "../api/patients";
import { PatientForm } from "../components/PatientForm";

/** Edits a patient's reference and sex — no wireframe exists for this
 *  screen's own layout, so it follows NewPatientPage's established
 *  pattern: a full page, not a modal, same form. */
export function EditPatientPage() {
  const { id } = useParams();
  const patientId = id!;
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const updatePatient = useUpdatePatient(patientId);

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

  return (
    <div className="page page--narrow">
      <Link to={`/patients/${patientId}`} className="back-link">
        ‹ {patient.data.data.reference}
      </Link>
      <h1 className="t-title">Edit patient</h1>
      <p className="t-body" style={{ marginBottom: "1.5rem" }}>
        Past visits and risk assessments are unaffected by this change.
      </p>

      <PatientForm
        initialReference={patient.data.data.reference}
        initialSex={patient.data.data.sex}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        isPending={updatePatient.isPending}
        error={updatePatient.error}
        onCancel={() => navigate(`/patients/${patientId}`)}
        onSubmit={(input) =>
          updatePatient.mutate(input, { onSuccess: () => navigate(`/patients/${patientId}`) })
        }
      />
    </div>
  );
}
