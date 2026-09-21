import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * The page-level failure screen: an outlined code over faint graph paper, a
 * plain-language heading, and one way out.
 *
 * It is for a whole page that cannot render — a missing route, a patient that
 * could not be loaded. An error inside a working page stays a `.banner`,
 * because the rest of that page is still usable and should not be replaced.
 */
export function ErrorState({
  code,
  title,
  description,
  action,
}: {
  /** The short marker over the heading: an HTTP status, or a word. */
  code: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="error-state">
      <div className="error-state__grid" aria-hidden="true" />

      <p className="error-state__code" aria-hidden="true">
        {code}
      </p>

      <h1 className="t-title" style={{ marginBottom: "0.75rem" }}>
        {title}
      </h1>
      <p className="t-body" style={{ maxWidth: "26rem" }}>
        {description}
      </p>

      <div style={{ marginTop: "1.75rem" }}>
        {action ?? (
          <Link to="/" className="btn">
            Back to patients
          </Link>
        )}
      </div>
    </div>
  );
}
