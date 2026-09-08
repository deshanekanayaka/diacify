import { useAuth } from "./lib/AuthContext";
import { SignInForm } from "./components/SignInForm";
import { PatientListPage } from "./pages/PatientListPage";

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  return session ? <PatientListPage /> : <SignInForm />;
}
