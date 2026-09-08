import { useState, type FormEvent } from "react";

import { ApiError } from "../lib/apiClient";
import { useCreatePatient, type PatientSex } from "../api/patients";
import "./NewChartTab.css";

/**
 * The blank tab pinned above the patient list. Tapping it opens an inline
 * add-patient form in the same tab's place; submitting closes it again.
 */
export function NewChartTab() {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [sex, setSex] = useState<PatientSex | "">("");
  const [error, setError] = useState<string | null>(null);
  const createPatient = useCreatePatient();

  if (!open) {
    return (
      <li className="new-chart-tab new-chart-tab--closed">
        <button type="button" onClick={() => setOpen(true)}>
          + New chart
        </button>
      </li>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!sex) {
      setError("Choose a sex.");
      return;
    }

    try {
      await createPatient.mutateAsync({ reference, sex });
      setReference("");
      setSex("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong.");
    }
  }

  return (
    <li className="new-chart-tab new-chart-tab--open">
      <form aria-label="New chart" onSubmit={handleSubmit}>
        <label>
          Reference
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={40}
            required
            autoFocus
          />
        </label>

        <fieldset>
          <legend>Sex</legend>
          <label>
            <input
              type="radio"
              name="sex"
              value="female"
              checked={sex === "female"}
              onChange={() => setSex("female")}
            />
            Female
          </label>
          <label>
            <input
              type="radio"
              name="sex"
              value="male"
              checked={sex === "male"}
              onChange={() => setSex("male")}
            />
            Male
          </label>
        </fieldset>

        {error && (
          <p className="new-chart-tab__error" role="alert">
            {error}
          </p>
        )}

        <div className="new-chart-tab__actions">
          <button type="submit" disabled={createPatient.isPending}>
            {createPatient.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" disabled={createPatient.isPending} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
