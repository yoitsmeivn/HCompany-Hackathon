import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import OnboardingPage from "@/pages/OnboardingPage";
import MonitoringPage from "@/pages/MonitoringPage";
import SessionsPage from "@/pages/SessionsPage";
import SessionPage, { SessionRedirect } from "@/pages/SessionPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import { useAppState } from "@/store/context";

// Send first-time users to onboarding; returning (configured) users go straight
// to the idle monitoring screen.
function RootGate() {
  const state = useAppState();
  if (state.loading.sessions) return null;
  return <Navigate to={state.preferences.configured ? "/monitor" : "/onboarding"} replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <RootGate /> },
  { path: "/onboarding", element: <OnboardingPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/monitor", element: <MonitoringPage /> },
      { path: "/sessions", element: <SessionsPage /> },
    ],
  },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/session", element: <SessionRedirect /> },
  { path: "/session/:sessionId", element: <SessionPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
