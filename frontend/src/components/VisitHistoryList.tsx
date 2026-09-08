import { VisitHistoryRow } from "./VisitHistoryRow";
import { useVisits } from "../api/visits";
import "./VisitHistoryList.css";

/** A patient's visit history, newest first, each row expandable in place. */
export function VisitHistoryList({ patientId }: { patientId: string }) {
  const { data, isLoading, isError } = useVisits(patientId);
  const visits = data?.data ?? [];

  return (
    <ul className="visit-history-list">
      {isLoading && (
        <li className="visit-history-list__status" aria-live="polite">
          Loading visits…
        </li>
      )}
      {isError && (
        <li className="visit-history-list__status visit-history-list__status--error" role="alert">
          Couldn't load this patient's visits. Try again.
        </li>
      )}
      {!isLoading && !isError && visits.length === 0 && (
        <li className="visit-history-list__status">No visits recorded yet — switch to New Visit above.</li>
      )}
      {visits.map((visit) => (
        <VisitHistoryRow key={visit.id} visit={visit} />
      ))}
    </ul>
  );
}
