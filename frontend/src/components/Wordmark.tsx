import { Link } from "react-router-dom";

/** The "Diacify" mark, linking home. Shared by every topbar so the mark
 *  itself can't drift between the signed-in and signed-out shells. */
export function Wordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="wordmark">
      Diacify
    </Link>
  );
}
