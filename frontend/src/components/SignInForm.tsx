import { useState, type FormEvent } from "react";

import { useAuth } from "../lib/AuthContext";

/**
 * Plain functional sign-in — deliberately outside the Tabbed Chart Binder
 * direction, which was shaped for the patient list only. Not a designed
 * surface yet.
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
    <form onSubmit={handleSubmit} style={{ maxWidth: "20rem", margin: "4rem auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  );
}
