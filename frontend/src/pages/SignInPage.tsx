import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../lib/AuthContext";
import type { SignInResult } from "../lib/AuthContext";
import { Field } from "../components/Field";

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
    <main className="page page--narrow">
      <form className="card stack" onSubmit={handleSubmit}>
        <div>
          <h1 className="t-title">Diacify</h1>
          <p className="t-body">Sign in to your patients.</p>
        </div>

        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {/* Two distinct states, not one error string: a rejected sign-in
            (wrong email or password — Supabase deliberately returns one
            message for both, so an attacker can't tell which emails have
            accounts) reads as the clinician's problem, while a down auth
            service must never be confused with that. */}
        {result?.outcome === "rejected" ? (
          <p className="banner banner--error" role="alert">
            {result.message}
          </p>
        ) : null}
        {result?.outcome === "service-unavailable" ? (
          <p className="banner banner--neutral" role="alert">
            {SERVICE_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        <button type="submit" className="btn btn--block" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="t-caption" style={{ textAlign: "center" }}>
          No account yet? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </main>
  );
}
