import { LayoutList } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import SessionsTable from "@/features/sessions/components/SessionsTable";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useAppDispatch, useAppState } from "@/store/context";
import { stateReset } from "@/store/actions";
import { selectComputerNames, selectCounts } from "@/store/selectors";
import * as persistence from "@/store/persistence";

export default function SessionsPage() {
  usePageTitle("Sessions");
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { sessions, loading } = state;
  const computerNames = selectComputerNames(state);
  const counts = selectCounts(state);

  const resetData = () => {
    if (window.confirm("Clear all local Kylian data? This cannot be undone.")) {
      persistence.clear();
      dispatch(stateReset());
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "28px 24px 48px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Sessions</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>Calls Kylian has handled on this computer.</p>
        </div>
        {sessions.length > 0 && (
          <span style={{ fontSize: 12.5, color: "#9a958c" }}>{counts.active} active · {counts.waiting} waiting on you</span>
        )}
      </div>

      {loading.sessions ? (
        <p style={{ marginTop: 24, fontSize: 12.5, color: "#9a958c" }}>Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <div style={{ marginTop: 22, border: "1px solid #e7e3dd", borderRadius: 9, background: "#fff", overflow: "hidden" }}>
          <EmptyState
            icon={<LayoutList size={17} strokeWidth={1.75} />}
            title="No sessions yet"
            description="When someone calls your Kylian number, the session will appear here."
            action={<Button to="/monitor">Back to monitoring</Button>}
          />
        </div>
      ) : (
        <>
          <SessionsTable sessions={sessions} computerNames={computerNames} />
          <p style={{ margin: "16px 2px 0", fontSize: 12, color: "#9a958c" }}>
            Showing {sessions.length} {sessions.length === 1 ? "session" : "sessions"} ·{" "}
            <button onClick={resetData} style={{ border: "none", background: "none", padding: 0, font: "inherit", color: "#9a958c", textDecoration: "underline", cursor: "pointer" }}>
              Reset local data
            </button>
          </p>
        </>
      )}
    </div>
  );
}
