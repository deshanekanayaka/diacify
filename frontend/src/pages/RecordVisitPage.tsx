import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { usePatient } from "../api/patients";
import { useCreateVisit } from "../api/visits";
import {
  REQUIRED_MEASUREMENTS,
  RECORDED_LABS,
  SCORED_LABS,
  toCreateVisitInput,
  type MeasurementName,
} from "../lib/visitForm";
import { ErrorState } from "../components/ErrorState";
import { Field } from "../components/Field";

/**
 * Records one visit's measurements. The backend scores it on the same call.
 *
 * Every field is on screen at once, in two columns beside a sticky aside that
 * holds the context and the submit button. The labs used to sit behind an
 * "add lipid panel" toggle at the bottom of a single column, which meant
 * scrolling past everything to find either them or the button.
 */
export function RecordVisitPage() {
  const { id } = useParams();
  const patientId = id!;
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const createVisit = useCreateVisit(patientId);

  const [visitDate, setVisitDate] = useState(today());
  const [values, setValues] = useState<Partial<Record<MeasurementName, string>>>({});

  function setValue(name: MeasurementName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createVisit.mutate(toCreateVisitInput(visitDate, values), {
      onSuccess: () => navigate(`/patients/${patientId}`),
    });
  }

  // Same ordering as PatientDetailPage: all hooks above run unconditionally,
  // and only after that do we decide whether there's a patient to record a
  // visit for at all - the form must not render while that's still unknown,
  // or (worse) render fully after it's failed.
  if (patient.isPending) {
    return <p className="placeholder">Loading patient…</p>;
  }
  if (patient.isError) {
    return (
      <div className="page">
        <ErrorState
          code="Not found"
          title="That patient could not be loaded."
          description={patient.error.message}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <form className="form-split" onSubmit={handleSubmit}>
        <aside className="form-split__aside stack">
          <Link to={`/patients/${patientId}`} className="back-link">
            ‹ {patient.data.data.reference}
          </Link>
          <h1 className="t-title">Record visit</h1>
          <p className="t-body">
            The visit is saved first, then scored — a scoring failure never loses the
            measurements.
          </p>

          {createVisit.isError ? (
            <p className="banner banner--error" role="alert">
              {createVisit.error.message}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn--block btn--large"
            disabled={createVisit.isPending}
          >
            {createVisit.isPending ? "Recording…" : "Record visit"}
          </button>
        </aside>

        {/* One card, three labelled groups. Three separate cards stacked
            their own padding three times over and pushed the last group off
            the screen, which is the scrolling this layout exists to remove. */}
        <div className="card stack form-split__fields">
          <section className="stack">
            {/* The date sits in the same grid as the measurements rather than
                on a full-width row of its own, which saved a row of height. */}
            <div className="field-grid">
              <Field label="Visit date">
                <input
                  type="date"
                  required
                  value={visitDate}
                  max={today()}
                  onChange={(event) => setVisitDate(event.target.value)}
                />
              </Field>
              {REQUIRED_MEASUREMENTS.map((measurement) => (
                <Field
                  key={measurement.name}
                  label={`${measurement.label} (${measurement.unit})`}
                >
                  <input
                    type="number"
                    required
                    step={measurement.step}
                    value={values[measurement.name] ?? ""}
                    onChange={(event) => setValue(measurement.name, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </section>

          <hr className="rule" />

          <section className="stack">
            <div>
              <p className="t-label">Labs used by the model</p>
              <p className="t-caption">
                Optional. A blank one falls back to the median the model learned at
                training time.
              </p>
            </div>
            <div className="field-grid">
              {SCORED_LABS.map((lab) => (
                <LabField
                  key={lab.name}
                  lab={lab}
                  value={values[lab.name] ?? ""}
                  onChange={(value) => setValue(lab.name, value)}
                />
              ))}
            </div>
          </section>

          <hr className="rule" />

          <section className="stack">
            <div>
              <p className="t-label">Recorded only</p>
              <p className="t-caption">Kept on the visit; not inputs to the risk model.</p>
            </div>
            <div className="field-grid">
              {RECORDED_LABS.map((lab) => (
                <LabField
                  key={lab.name}
                  lab={lab}
                  value={values[lab.name] ?? ""}
                  onChange={(value) => setValue(lab.name, value)}
                />
              ))}
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

function LabField({
  lab,
  value,
  onChange,
}: {
  lab: { label: string; unit: string };
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={`${lab.label} (${lab.unit})`}>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** Today in the browser's own timezone, as the yyyy-mm-dd an input[type=date] wants. */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
