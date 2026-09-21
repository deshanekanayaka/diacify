import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthField, AuthLayout, AuthSubmit } from "../components/AuthLayout";
import { useAuth } from "../lib/AuthContext";

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
      <AuthLayout
        title="Check your inbox."
        subtitle={`We sent a confirmation link to ${email}. Confirm your email, then sign in.`}
        panelLine="One clinician, one account, one patient list."
      >
        <Link
          to="/signin"
          className="block w-full rounded-full bg-primary px-6 py-3.5 text-center text-[0.95rem] font-medium text-primary-foreground transition-all hover:bg-[#0e2a1f] active:scale-[0.98]"
        >
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account."
      subtitle="One clinician, one account, one patient list."
      panelLine="Trained on real patient records. Scored in seconds. Every visit kept."
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
        <AuthField label="Password" hint="At least 6 characters.">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>

        {error ? (
          <p
            className="rounded-xl bg-[#fbeae7] px-4 py-3 text-[0.95rem] text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <AuthSubmit disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </AuthSubmit>

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link
            to="/signin"
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
