import { useState, type FormEvent } from "react";

import { useAuth } from "../lib/AuthContext";
import "./SignInForm.css";

/**
 * Plain functional sign-in — deliberately outside the Tabbed Chart Binder
 * direction, which was shaped for the patient list only. Still styled
 * enough to read as a finished screen rather than broken markup.
 */
export function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = await signIn(email, password);
    setError(message);
  }

  return (
    <form className="sign-in-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error && (
        <p className="sign-in-form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Sign in</button>
    </form>
  );
}
