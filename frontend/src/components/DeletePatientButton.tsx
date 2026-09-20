import { useState } from "react";

import { useDeletePatient } from "../api/patients";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconTrash } from "./icons";

interface DeletePatientButtonProps {
  patientId: string;
  reference: string;
  className?: string;
  onDeleted?: () => void;
  /** "label" (default) shows the word "Delete" — used on the profile
   *  screen's own-sized button. "icon" shows a bare trash icon — used in
   *  the patient table row, where every action is icon-only. */
  variant?: "label" | "icon";
}

/**
 * A confirm-then-delete control shared by the patient list row and the
 * patient profile screen. Deleting a patient is irreversible — the backend
 * cascades away every visit and risk assessment with it — so both call
 * sites go through the same confirmation rather than each rolling their own.
 */
export function DeletePatientButton({
  patientId,
  reference,
  className,
  onDeleted,
  variant = "label",
}: DeletePatientButtonProps) {
  const deletePatient = useDeletePatient();
  const [isConfirming, setIsConfirming] = useState(false);

  function handleConfirm() {
    deletePatient.mutate(patientId, {
      onSuccess: () => {
        setIsConfirming(false);
        onDeleted?.();
      },
      onError: () => setIsConfirming(false),
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setIsConfirming(true)}
        disabled={deletePatient.isPending}
        aria-label={variant === "icon" ? `Delete ${reference}` : undefined}
        title={variant === "icon" ? "Delete" : undefined}
      >
        {variant === "icon" ? <IconTrash /> : deletePatient.isPending ? "Deleting…" : "Delete"}
      </button>
      {/* A failed delete otherwise leaves the button simply clickable again,
          with nothing telling the clinician it didn't work. */}
      {deletePatient.isError ? (
        <span role="alert" className="t-caption" style={{ color: "var(--danger)" }}>
          {deletePatient.error.message}
        </span>
      ) : null}

      <ConfirmDialog
        isOpen={isConfirming}
        title={`Delete ${reference}?`}
        body="This permanently erases every visit and risk assessment on their chart. It cannot be undone."
        confirmLabel="Delete patient"
        isConfirming={deletePatient.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirming(false)}
      />
    </>
  );
}
