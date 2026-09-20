import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./lib/AuthContext";
import { AppShell } from "./components/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { PatientListPage } from "./pages/PatientListPage";
import { NewPatientPage } from "./pages/NewPatientPage";
import { EditPatientPage } from "./pages/EditPatientPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import { RecordVisitPage } from "./pages/RecordVisitPage";

/**
 * Two route sets, not one set with per-route guards: signed out, the signed-in
 * routes do not exist at all, so there is no path that renders a patient
 * screen without a session to fetch it with.
 */
export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<PatientListPage />} />
        <Route path="/patients/new" element={<NewPatientPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/patients/:id/edit" element={<EditPatientPage />} />
        <Route path="/patients/:id/visits/new" element={<RecordVisitPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
