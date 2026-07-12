import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import KylianLogo from "@/components/brand/KylianLogo";
import SessionView from "@/features/live-session/components/SessionView";
import { useAppDispatch, useAppState } from "@/store/context";
import { liveSessionInitialized } from "@/store/actions";
import {
  selectComputerNames,
  selectMostRecentActiveSession,
  selectSessionById,
} from "@/store/selectors";
import { emptyLiveSession } from "@/store/initialState";
import { subscribeToSessionEvents } from "@/services/orchestrationService";
import { applyRuntimeEvent } from "@/integrations/runtimeEvents";

// /session — jump to the most recent active session, else back to the dashboard.
export function SessionRedirect() {
  const state = useAppState();
  if (state.loading.sessions) return null;
  const session = selectMostRecentActiveSession(state);
  return <Navigate to={session ? `/session/${session.id}` : "/monitor"} replace />;
}

function SessionNotFound() {
  usePageTitle("Session not found");
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 28,
        textAlign: "center",
      }}
    >
      <KylianLogo size={34} />
      <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
        Session not found
      </h1>
      <p style={{ margin: 0, fontSize: 13.5, color: "#6a665f", maxWidth: 380, lineHeight: 1.6 }}>
        This session doesn’t exist or has expired from history.
      </p>
      <Link
        to="/sessions"
        className="k-primary"
        style={{
          marginTop: 10,
          borderRadius: 6,
          background: "#1c1b19",
          color: "#fff",
          padding: "10px 18px",
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          transition: "background .15s",
        }}
      >
        Back to dashboard
      </Link>
    </main>
  );
}

export default function SessionPage() {
  usePageTitle("Live session");

  const { sessionId } = useParams();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const session = selectSessionById(state, sessionId);
  const live = session ? state.live[session.id] : undefined;

  // Live data is never persisted, so a refreshed page starts with an empty
  // live record for the session.
  useEffect(() => {
    if (session && !live) dispatch(liveSessionInitialized(session.id));
  }, [session, live, dispatch]);

  useEffect(() => {
    if (!session) return;
    return subscribeToSessionEvents(session.id, ({ event }) => applyRuntimeEvent(dispatch, event));
  }, [session, dispatch]);

  if (state.loading.sessions) return null;
  if (!session) return <SessionNotFound />;

  const computerName = selectComputerNames(state)[session.computerId] ?? "Unknown computer";

  return (
    <SessionView
      session={session}
      computerName={computerName}
      live={live ?? emptyLiveSession()}
      computer={state.computers.find((item) => item.id === session.computerId)}
    />
  );
}
