import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import DeepLinks from "./lib/useDeepLinks.js";
import { apiEnabled } from "./lib/api.js";

// Carga diferida por ruta (code-splitting): el visitante de un evento público
// no descarga el código completo del panel del anfitrión (HostApp), y viceversa.
const HostApp        = lazy(() => import("./HostApp.jsx"));
const OnboardingFlow = lazy(() => import("./components/OnboardingFlow.jsx"));
const PublicEventPage = lazy(() => import("./pages/PublicEventPage.jsx"));
const TicketPage     = lazy(() => import("./pages/TicketPage.jsx"));
const LoginPage      = lazy(() => import("./pages/LoginPage.jsx"));
const PrivacyPage    = lazy(() => import("./pages/PrivacyPage.jsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage.jsx"));
const DiscoverPage   = lazy(() => import("./pages/DiscoverPage.jsx"));

const Loading = () => (
  <div className="tf-screen"><div className="tf-body"><p>Cargando…</p></div></div>
);

function AppGate() {
  const { user, loading, apiEnabled: apiOn } = useAuth();
  const [pendingDraft, setPendingDraft] = useState(null);

  if (!apiOn) return <HostApp />;
  if (loading) return <Loading />;
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
        <DeepLinks />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/e/:slug" element={<PublicEventPage />} />
            <Route path="/t/:ticketId" element={<TicketPage />} />
            <Route path="/privacidad" element={<PrivacyPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/app" element={<AppGate />} />
            <Route path="/" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
