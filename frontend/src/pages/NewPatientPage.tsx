import { Link, useNavigate } from "react-router-dom";

import { useCreatePatient } from "../api/patients";
import { PatientForm } from "../components/PatientForm";

/** Creates a patient. Visits and vitals are recorded afterwards, on the chart. */
export function NewPatientPage() {
  const navigate = useNavigate();
  const createPatient = useCreatePatient();

  return (
    <div className="page page--narrow">
      <Link to="/" className="back-link">
        ‹ Patients
      </Link>
      <h1 className="t-title">New patient</h1>
      <p className="t-body" style={{ marginBottom: "1.5rem" }}>
        Visits and vitals are recorded after the patient is created.
      </p>

      <PatientForm
        submitLabel="Create patient"
        pendingLabel="Creating…"
        isPending={createPatient.isPending}
        error={createPatient.error}
        onCancel={() => navigate("/")}
        onSubmit={(input) =>
          createPatient.mutate(input, { onSuccess: ({ data }) => navigate(`/patients/${data.id}`) })
        }
      />
    </div>
  );
}
