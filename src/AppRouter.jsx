import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import HostApp from "./HostApp.jsx";
import OnboardingFlow from "./components/OnboardingFlow.jsx";
import PublicEventPage from "./pages/PublicEventPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import { apiEnabled } from "./lib/api.js";

function AppGate() {
  const { user, loading, apiEnabled: apiOn } = useAuth();
  const [pendingDraft, setPendingDraft] = useState(null);

  if (!apiOn) return <HostApp />;
  if (loading) return <div className="tf-screen"><div className="tf-body"><p>Cargando…</p></div></div>;
  if (!user) return <OnboardingFlow onDraftReady={setPendingDraft} />;
  return (
    <HostApp
      initialDraft={pendingDraft}
      onDraftConsumed={() => setPendingDraft(null)}
    />
  );
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/e/:slug" element={<PublicEventPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<AppGate />} />
          <Route path="/" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
