import { NewChartTab } from "../components/NewChartTab";
import { PatientTab } from "../components/PatientTab";
import { usePatients } from "../api/patients";
import "../components/PatientDrawer.css";

/** The patient list + add-patient surface: a drawer of chart tabs, newest first. */
export function PatientListPage() {
  const { data, isLoading, isError } = usePatients();
  const patients = data?.data ?? [];

  return (
    <ul className="patient-drawer">
      <NewChartTab />

      {isLoading && (
        <li className="patient-drawer__status" aria-live="polite">
          Loading patients…
        </li>
      )}

      {isError && (
        <li className="patient-drawer__status patient-drawer__status--error" role="alert">
          Couldn't load your patients. Try again.
        </li>
      )}

      {!isLoading && !isError && patients.length === 0 && (
        <li className="patient-drawer__status">No patients yet — start your first chart above.</li>
      )}

      {patients.map((patient) => (
        <PatientTab key={patient.id} patient={patient} />
      ))}
    </ul>
  );
}
