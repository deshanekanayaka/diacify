import { useDeletePatient } from "../api/patients";
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
 * sites go through the same native confirmation rather than each rolling
 * their own, and there is deliberately no custom "are you sure" dialog
 * component for one rare, destructive action.
 */
export function DeletePatientButton({
  patientId,
  reference,
  className,
  onDeleted,
  variant = "label",
}: DeletePatientButtonProps) {
  const deletePatient = useDeletePatient();

  function handleClick() {
    const confirmed = window.confirm(
      `Delete ${reference}? This permanently erases every visit and risk assessment on their chart. This cannot be undone.`,
    );
    if (!confirmed) return;

    deletePatient.mutate(patientId, { onSuccess: onDeleted });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={deletePatient.isPending}
      aria-label={variant === "icon" ? `Delete ${reference}` : undefined}
      title={variant === "icon" ? "Delete" : undefined}
    >
      {variant === "icon" ? <IconTrash /> : deletePatient.isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
