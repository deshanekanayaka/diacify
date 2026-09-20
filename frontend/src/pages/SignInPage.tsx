import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthField, AuthLayout, AuthSubmit } from "../components/AuthLayout";
import { useAuth } from "../lib/AuthContext";
import type { SignInResult } from "../lib/AuthContext";

const SERVICE_UNAVAILABLE_MESSAGE =
  "Sign-in is unavailable right now. This is on our side, not yours. Try again in a moment.";

/**
 * Sign-in. Supabase owns the session end to end — this screen makes no
 * backend request of its own.
 */
export function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<SignInResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(await signIn(email, password));
    setIsSubmitting(false);
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your patients."
      panelLine="Diabetes risk classification, before the patient leaves the room."
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <AuthField label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>

        {/* Two distinct states, not one error string: a rejected sign-in
            (wrong email or password — Supabase deliberately returns one
            message for both, so an attacker can't tell which emails have
            accounts) reads as the clinician's problem, while a down auth
            service must never be confused with that. */}
        {result?.outcome === "rejected" ? (
          <p
            className="rounded-xl bg-[#fbeae7] px-4 py-3 text-[0.95rem] text-destructive"
            role="alert"
          >
            {result.message}
          </p>
        ) : null}
        {result?.outcome === "service-unavailable" ? (
          <p
            className="rounded-xl bg-muted px-4 py-3 text-[0.95rem] text-muted-foreground"
            role="alert"
          >
            {SERVICE_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        <AuthSubmit disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </AuthSubmit>

        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link
            to="/signup"
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
