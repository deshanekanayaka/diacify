import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

/**
 * The outcome of a sign-in attempt. Rejected credentials and an unreachable
 * auth service are kept as two distinct shapes rather than one error string
 * — wrong password and "we couldn't even ask" are different situations,
 * and collapsing them would make an outage read as "your password is
 * wrong" (see wireframes' sign-in states).
 */
export type SignInResult =
  | { outcome: "signed-in" }
  | { outcome: "rejected"; message: string }
  | { outcome: "service-unavailable" };

export interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Reads the current auth session/actions; must be called under `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
