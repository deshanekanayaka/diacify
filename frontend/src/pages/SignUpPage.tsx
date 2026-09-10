import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../lib/AuthContext";
import { Field } from "../components/Field";

/**
 * Account creation. The Supabase project requires email confirmation, so a
 * successful submit ends on a "check your inbox" state rather than a signed-in
 * session — that pending step is the whole reason this screen exists.
 */
export function SignUpPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmationPending, setIsConfirmationPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    const message = await signUp(email, password);
    setError(message);
    setIsConfirmationPending(message === null);
    setIsSubmitting(false);
  }

  if (isConfirmationPending) {
    return (
      <main className="page page--narrow">
        <div className="card stack">
          <h1 className="t-title">Check your inbox</h1>
          <p className="t-body">
            We sent a confirmation link to <strong>{email}</strong>. Confirm your email, then sign
            in.
          </p>
          <Link to="/signin" className="btn btn--block">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <form className="card stack" onSubmit={handleSubmit}>
        <div>
          <h1 className="t-title">Create your account</h1>
          <p className="t-body">One clinician, one account, one patient list.</p>
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
        <Field label="Password" hint="At least 6 characters.">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn--block" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
        <p className="t-caption" style={{ textAlign: "center" }}>
          Already have one? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
