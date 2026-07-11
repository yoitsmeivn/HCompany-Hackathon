import { createBrowserRouter, Navigate } from "react-router-dom";
import MarketingLayout from "@/layouts/MarketingLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import LandingPage from "@/pages/LandingPage";
import SetupPage from "@/pages/SetupPage";
import DashboardPage from "@/pages/DashboardPage";
import ComputersPage from "@/pages/ComputersPage";
import FilesPage from "@/pages/FilesPage";
import SessionPage from "@/pages/SessionPage";
import NotFoundPage from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/setup", element: <SetupPage /> },
      { path: "/demo", element: <Navigate to="/setup" replace /> },
    ],
  },
  {
    element: <DashboardLayout />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/computers", element: <ComputersPage /> },
      { path: "/files", element: <FilesPage /> },
    ],
  },
  { path: "/session", element: <Navigate to="/session/demo-session" replace /> },
  { path: "/session/:sessionId", element: <SessionPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
