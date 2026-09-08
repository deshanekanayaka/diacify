import { NewChartTab } from "../components/NewChartTab";
import { PatientTab } from "../components/PatientTab";
import { usePatients } from "../api/patients";
import "../components/PatientDrawer.css";

/** The patient list + add-patient surface: a drawer of chart tabs, newest first. */
export function PatientListPage() {
  const { data, isLoading, isError } = usePatients();

  if (isLoading) {
    return <p>Loading patients…</p>;
  }

  if (isError) {
    return <p role="alert">Couldn't load your patients. Try again.</p>;
  }

  const patients = data?.data ?? [];

  return (
    <ul className="patient-drawer">
      <NewChartTab />
      {patients.length === 0 && (
        <li className="patient-drawer__empty" aria-hidden={false}>
          No patients yet — start your first chart above.
        </li>
      )}
      {patients.map((patient) => (
        <PatientTab key={patient.id} patient={patient} />
      ))}
    </ul>
  );
}
