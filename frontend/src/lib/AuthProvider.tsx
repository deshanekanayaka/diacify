import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import { AuthContext, type SignInResult } from "./AuthContext";

/** Tracks the current Supabase session and exposes sign-in/out actions to the app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { outcome: "signed-in" };

    // signInWithPassword never throws for a down/unreachable auth service —
    // it resolves with this error name (status 0) instead of the normal
    // "invalid credentials" one. Checked here rather than assumed, because
    // conflating the two would tell a clinician their password is wrong
    // during an outage that has nothing to do with them.
    if (error.name === "AuthRetryableFetchError") {
      return { outcome: "service-unavailable" };
    }
    return { outcome: "rejected", message: error.message };
  }

  /** Creates an account. The project requires email confirmation, so a
   *  success here means "check your inbox", not "you are signed in". */
  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
