import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { usePatients, type PatientListItem, type PatientRiskFilter, type PatientSort } from "../api/patients";
import { DeletePatientButton } from "../components/DeletePatientButton";
import { RiskBadge } from "../components/RiskBadge";
import { IconPencil } from "../components/icons";
import { formatDate } from "../lib/format";

const PAGE_SIZE = 20;

type RiskFilter = "all" | PatientRiskFilter;

const RISK_FILTERS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unscored", label: "Not scored" },
];

/**
 * The patient list: the signed-in home screen.
 *
 * The risk filter and sort are server-side params (patients_with_latest_risk,
 * usePatients) — the fetched batch is already the right up-to-100 patients
 * for the current filter/sort, not just the newest 100 overall. Only the
 * reference search box stays client-side, over that already-small fetched
 * batch.
 */
export function PatientListPage() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [referenceQuery, setReferenceQuery] = useState("");
  const [sort, setSort] = useState<PatientSort>("newest");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error } = usePatients({
    risk: riskFilter === "all" ? undefined : riskFilter,
    sort: sort === "risk" ? "risk" : undefined,
  });

  const patients = useMemo(() => data?.data ?? [], [data]);

  const visible = useMemo(() => filterByReference(patients, referenceQuery), [patients, referenceQuery]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilter(next: RiskFilter) {
    setRiskFilter(next);
    setPage(1);
  }

  return (
    <div className="page">
      <div className="row row--between" style={{ marginBottom: "1.25rem" }}>
        <h1 className="t-title">Patients</h1>
        <Link to="/patients/new" className="btn">
          New patient
        </Link>
      </div>

      {isPending ? <p className="placeholder">Loading patients…</p> : null}

      {isError ? (
        <p className="banner banner--error" role="alert">
          {error.message}
        </p>
      ) : null}

      {data && data.data.length === 0 ? (
        <div className="card placeholder">
          <p className="t-section" style={{ color: "var(--ink)" }}>
            No patients yet
          </p>
          <p className="t-body" style={{ marginBottom: "1.5rem" }}>
            Add your first patient, then record their visit to get a risk score.
          </p>
          <Link to="/patients/new" className="btn">
            New patient
          </Link>
        </div>
      ) : null}

      {data && data.data.length > 0 ? (
        <>
          <div className="row" style={{ marginBottom: "0.5rem" }}>
            <input
              placeholder="Filter by ref…"
              value={referenceQuery}
              onChange={(event) => {
                setReferenceQuery(event.target.value);
                setPage(1);
              }}
              style={{
                maxWidth: "220px",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--separator-strong)",
                font: "inherit",
                fontSize: "0.875rem",
              }}
            />
            <select
              aria-label="Sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as PatientSort);
                setPage(1);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--separator-strong)",
                font: "inherit",
                fontSize: "0.875rem",
                background: "var(--surface)",
              }}
            >
              <option value="newest">Sort: newest first</option>
              <option value="risk">Sort: highest risk first</option>
            </select>
          </div>

          <div className="row" style={{ marginBottom: "0.75rem" }}>
            {RISK_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="filter-pill"
                aria-pressed={riskFilter === option.value}
                onClick={() => updateFilter(option.value)}
              >
                {option.label}
                {riskFilter === option.value ? ` ${visible.length}` : ""}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="card placeholder">
              <p className="t-body">No patients match this filter.</p>
            </div>
          ) : (
            <>
              <div className="card card--flush table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Sex</th>
                      <th>Last seen</th>
                      <th>Visits</th>
                      <th>Latest risk</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((patient) => (
                      <PatientRow key={patient.id} patient={patient} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row row--between" style={{ marginTop: "0.75rem" }}>
                <p className="t-caption">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {(currentPage - 1) * PAGE_SIZE + pageItems.length} of {visible.length}
                </p>
                {totalPages > 1 ? (
                  <PageNav page={currentPage} totalPages={totalPages} onChange={setPage} />
                ) : null}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

/** One patient row: reference (the click target to the profile) plus every other column and its actions. */
function PatientRow({ patient }: { patient: PatientListItem }) {
  return (
    <tr>
      <td>
        <Link to={`/patients/${patient.id}`} className="t-num" style={{ fontWeight: 600 }}>
          {patient.reference}
        </Link>
      </td>
      <td style={{ textTransform: "capitalize" }}>{patient.sex}</td>
      <td>{patient.last_visit_date ? formatDate(patient.last_visit_date) : "—"}</td>
      <td className="t-num">{patient.visit_count}</td>
      <td>
        <RiskBadge assessment={patient.risk_assessment} />
      </td>
      <td>
        <div className="row" style={{ justifyContent: "flex-end", gap: "0.75rem" }}>
          <Link to={`/patients/${patient.id}/visits/new`} className="list-row__action">
            + Visit
          </Link>
          <Link
            to={`/patients/${patient.id}/edit`}
            className="icon-action"
            aria-label={`Edit ${patient.reference}`}
            title="Edit"
          >
            <IconPencil />
          </Link>
          <DeletePatientButton
            patientId={patient.id}
            reference={patient.reference}
            className="icon-action icon-action--danger"
            variant="icon"
          />
        </div>
      </td>
    </tr>
  );
}

/** Page-number controls. A clinician's own patient list stays small, so
 *  every page gets its own button rather than an ellipsis-collapsed range. */
function PageNav({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className="pagination" aria-label="Patients pages">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
        ‹
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          aria-current={pageNumber === page}
          onClick={() => onChange(pageNumber)}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}

/** Applies the reference search to the already server-filtered/sorted batch. */
function filterByReference(patients: PatientListItem[], referenceQuery: string): PatientListItem[] {
  const query = referenceQuery.trim().toLowerCase();
  if (!query) return patients;
  return patients.filter((patient) => patient.reference.toLowerCase().includes(query));
}
