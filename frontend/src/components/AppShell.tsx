import type { ReactNode } from "react";

import { useAuth } from "../lib/AuthContext";
import "./AppShell.css";

/** Page chrome around every authenticated screen: wordmark, signed-in clinician, sign out. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__wordmark">Diacify</span>
        <div className="app-shell__account">
          <span>{session?.user.email}</span>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
