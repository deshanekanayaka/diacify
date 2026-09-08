import { useAuth } from "./lib/AuthContext";
import { AppShell } from "./components/AppShell";
import { SignInForm } from "./components/SignInForm";
import { PatientListPage } from "./pages/PatientListPage";

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <SignInForm />;
  }

  return (
    <AppShell>
      <PatientListPage />
    </AppShell>
  );
}
