import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** A labelled form control. Wraps rather than renders the input so callers
 *  keep full control of type, step, and validation attributes. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
