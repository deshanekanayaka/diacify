import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "../lib/AuthContext";
import { Wordmark } from "./Wordmark";

/** The signed-in chrome: wordmark, account menu, and the page beneath. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? "";

  return (
    <>
      <header className="topbar">
        <Wordmark />
        <span className="spacer" />
        <AccountMenu email={email} onSignOut={signOut} />
      </header>
      <main>{children}</main>
    </>
  );
}

function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // A menu that only closes on its own trigger feels broken; clicking
  // anywhere else is how every OS menu behaves.
  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div className="avatar-menu" ref={container}>
      <button type="button" aria-label="Account" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <span className="avatar">{email.slice(0, 1) || "?"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {isOpen ? (
        <div className="menu-drop">
          <div className="menu-head">{email}</div>
          {/* Sign-out must go through the SDK: the session is persisted, so
              clearing UI state alone would leave the clinician signed in. */}
          <button type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
