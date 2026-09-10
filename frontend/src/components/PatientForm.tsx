import { useState, type FormEvent } from "react";

import type { CreatePatientInput, PatientSex } from "../api/patients";
import { Field } from "./Field";

interface PatientFormProps {
  initialReference?: string;
  initialSex?: PatientSex;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: Error | null;
  onSubmit: (input: CreatePatientInput) => void;
  onCancel: () => void;
}

/**
 * The reference + sex form shared by creating and editing a patient — the
 * two screens differ only in title, initial values, and what happens after
 * submit, so the fields themselves live here once.
 */
export function PatientForm({
  initialReference = "",
  initialSex = "female",
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: PatientFormProps) {
  const [reference, setReference] = useState(initialReference);
  const [sex, setSex] = useState<PatientSex>(initialSex);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ reference: reference.trim(), sex });
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <Field label="Reference" hint="The identifier you use for this patient. Must be unique to you.">
        <input
          required
          maxLength={40}
          placeholder="e.g. AH-2291"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </Field>

      {/* Sex, not gender: it is a model input encoded from the training
          dataset's two recorded values, not a demographic field. */}
      <div className="field">
        <span>Sex</span>
        <div className="segmented">
          <button type="button" aria-pressed={sex === "female"} onClick={() => setSex("female")}>
            Female
          </button>
          <button type="button" aria-pressed={sex === "male"} onClick={() => setSex("male")}>
            Male
          </button>
        </div>
        <span className="field-hint">Used by the risk model, not as a demographic record.</span>
      </div>

      {error ? (
        <p className="banner banner--error" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="row">
        <button type="submit" className="btn" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
