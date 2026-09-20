import { useEffect, useRef } from "react";

import { IconWarning } from "./icons";

/**
 * A confirmation before a destructive action.
 *
 * Built on the native `<dialog>` element rather than a hand-rolled overlay:
 * the browser gives the focus trap, the Escape key, the top layer and the
 * backdrop for free, and every hand-rolled modal gets at least one of those
 * wrong. It replaces `window.confirm`, which cannot be styled and which
 * announces the origin ("localhost:5173 says") in place of the product.
 */
export function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  isConfirming,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (isOpen && !element.open) element.showModal();
    if (!isOpen && element.open) element.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className="modal"
      // Escape and a backdrop dismissal both fire `cancel`, so the parent's
      // state stays in step with what the browser did.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="modal__icon" aria-hidden="true">
        <IconWarning />
      </div>
      <h2 className="t-section" style={{ marginBottom: "0.5rem" }}>
        {title}
      </h2>
      <p className="t-body">{body}</p>

      <div className="modal__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onCancel}
          disabled={isConfirming}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
