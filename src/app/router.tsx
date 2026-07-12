import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import MarketingLayout from "@/layouts/MarketingLayout";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import MonitoringPage from "@/pages/MonitoringPage";
import SessionsPage from "@/pages/SessionsPage";
import SessionPage, { SessionRedirect } from "@/pages/SessionPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [{ path: "/", element: <LandingPage /> }],
  },
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
