import { LayoutList } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import SessionsTable from "@/features/sessions/components/SessionsTable";
import DemoDataActions from "@/features/demo/components/DemoDataActions";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useAppDispatch, useAppState } from "@/store/context";
import { stateReset } from "@/store/actions";
import { selectComputerNames, selectCounts } from "@/store/selectors";
import * as persistence from "@/store/persistence";

export default function DashboardPage() {
  usePageTitle("Sessions");

  const state = useAppState();
  const dispatch = useAppDispatch();
  const { sessions, loading, errors } = state;
  const computerNames = selectComputerNames(state);
  const counts = selectCounts(state);
  const newSessionTarget = state.computers.length > 0 ? "/new-session" : "/setup";

  const resetData = () => {
    if (window.confirm("Clear all local Kylian data? This cannot be undone.")) {
      persistence.clear();
      dispatch(stateReset());
    }
  };

  const tableCardStyle = {
    marginTop: 22,
    border: "1px solid #e7e3dd",
    borderRadius: 9,
    background: "#fff",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  } as const;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
            Recent sessions
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
            Tasks Kylian has run on your computer.
          </p>
        </div>
        {sessions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "#9a958c", marginRight: 4 }}>
              {counts.active} active · {counts.waiting} waiting on you
            </span>
            {["All computers", "Any status"].map((label) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 6,
                  border: "1px solid #e7e3dd",
                  background: "#fff",
                  padding: "6px 11px",
                  fontSize: 12.5,
                  fontWeight: 450,
                  color: "#6a665f",
                }}
              >
                {label} <span style={{ opacity: 0.5 }}>▾</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading.sessions ? (
        <div style={tableCardStyle}>
          <p style={{ margin: 0, padding: "28px 18px", fontSize: 12.5, color: "#9a958c" }}>
            Loading sessions…
          </p>
        </div>
      ) : errors.sessions ? (
        <div style={tableCardStyle}>
          <div style={{ padding: "28px 18px" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--k-danger)" }}>
              Couldn’t load sessions: {errors.sessions}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a958c" }}>
              Reload the page to try again.
            </p>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div style={tableCardStyle}>
          <EmptyState
            icon={<LayoutList size={17} strokeWidth={1.75} />}
            title="No sessions yet"
            description="Connect a computer, then call or message Kylian to start your first session."
            action={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Button to={newSessionTarget}>
                  {state.computers.length > 0 ? "New session" : "Connect a computer"}
                </Button>
                <DemoDataActions />
              </div>
            }
          />
        </div>
      ) : (
        <>
          <SessionsTable sessions={sessions} computerNames={computerNames} />
          <p style={{ margin: "16px 2px 0", fontSize: 12, color: "#9a958c" }}>
            Showing {sessions.length} recent {sessions.length === 1 ? "session" : "sessions"} ·
            Sessions expire from history after 30 days ·{" "}
            <button
              onClick={resetData}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                font: "inherit",
                color: "#9a958c",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Reset demo data
            </button>
          </p>
        </>
      )}
    </>
  );
}
