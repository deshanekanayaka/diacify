import { useState, type FormEvent } from "react";

import { ApiError } from "../lib/apiClient";
import { useCreateVisit, type CreateVisitInput, type Visit } from "../api/visits";
import "./VisitForm.css";

interface FieldSpec {
  name: keyof CreateVisitInput;
  label: string;
  unit: string;
  step: number;
  required?: boolean;
}

const REQUIRED_FIELDS: FieldSpec[] = [
  { name: "age", label: "Age", unit: "years", step: 1, required: true },
  { name: "systolic", label: "Systolic BP", unit: "mmHg", step: 0.1, required: true },
  { name: "diastolic", label: "Diastolic BP", unit: "mmHg", step: 0.1, required: true },
  { name: "bmi", label: "BMI", unit: "kg/m²", step: 0.01, required: true },
  { name: "hba1c", label: "HbA1c", unit: "%", step: 0.01, required: true },
];

const OPTIONAL_FIELDS: FieldSpec[] = [
  { name: "rbs", label: "Random blood sugar", unit: "mg/dL", step: 0.01 },
  { name: "cholesterol", label: "Cholesterol", unit: "mg/dL", step: 0.01 },
  { name: "triglycerides", label: "Triglycerides", unit: "mg/dL", step: 0.01 },
  { name: "hdl", label: "HDL", unit: "mg/dL", step: 0.01 },
  { name: "ldl", label: "LDL", unit: "mg/dL", step: 0.01 },
  { name: "vldl", label: "VLDL", unit: "mg/dL", step: 0.01 },
];

type FormValues = Record<string, string>;

/** The vitals entry form for a new visit; scores inline and hands the result to its caller. */
export function VisitForm({ patientId, onRecorded }: { patientId: string; onRecorded: (visit: Visit) => void }) {
  const [values, setValues] = useState<FormValues>({});
  const [error, setError] = useState<string | null>(null);
  const createVisit = useCreateVisit(patientId);

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const input: Record<string, number> = {};
    for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
      const raw = values[field.name];
      if (raw === undefined || raw === "") continue;
      input[field.name] = Number(raw);
    }

    try {
      const { data } = await createVisit.mutateAsync(input as unknown as CreateVisitInput);
      setValues({});
      onRecorded(data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong.");
    }
  }

  return (
    <form className="visit-form" aria-label="Record visit" onSubmit={handleSubmit}>
      <div className="visit-form__grid">
        {REQUIRED_FIELDS.map((field) => (
          <label key={field.name}>
            {field.label} <span className="visit-form__unit">({field.unit})</span>
            <input
              type="number"
              step={field.step}
              required
              value={values[field.name] ?? ""}
              onChange={(event) => setValue(field.name, event.target.value)}
            />
          </label>
        ))}
      </div>

      <fieldset>
        <legend>Labs (optional)</legend>
        <div className="visit-form__grid">
          {OPTIONAL_FIELDS.map((field) => (
            <label key={field.name}>
              {field.label} <span className="visit-form__unit">({field.unit})</span>
              <input
                type="number"
                step={field.step}
                value={values[field.name] ?? ""}
                onChange={(event) => setValue(field.name, event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="visit-form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={createVisit.isPending}>
        {createVisit.isPending ? "Scoring…" : "Record visit"}
      </button>
    </form>
  );
}
