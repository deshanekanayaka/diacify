import { Route, Routes } from "react-router-dom";

import { useAuth } from "./lib/AuthContext";
import { AppShell } from "./components/AppShell";
import { SignInForm } from "./components/SignInForm";
import { PatientListPage } from "./pages/PatientListPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";

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
      <Routes>
        <Route path="/" element={<PatientListPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
      </Routes>
    </AppShell>
  );
}
