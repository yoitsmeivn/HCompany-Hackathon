import { useState } from "react";
import { Link } from "react-router-dom";
import LiveFeed from "./LiveFeed";
import ConversationPanel from "./ConversationPanel";
import ActivityTimeline from "./ActivityTimeline";
import CandidateFiles from "./CandidateFiles";
import ApprovalCard from "./ApprovalCard";
import type { Session } from "@/features/sessions/types";
import type { Computer } from "@/features/devices/types";
import type { LiveSessionData } from "@/features/live-session/types";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { useAppDispatch } from "@/store/context";
import {
  approvalResolved,
  candidateSelected,
  liveConnectionChanged,
  sessionMessageAdded,
  sessionMutedChanged,
  sessionPausedChanged,
  sessionUpdated,
} from "@/store/actions";
import { sendSessionMessage } from "@/services/orchestrationService";

const ctrlButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid #e7e3dd",
  borderRadius: 7,
  background: "#fff",
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 500,
  color: "#3a382f",
  cursor: "pointer",
  transition: "all .12s",
} as const;

function StatusBadge({ live }: { live: LiveSessionData }) {
  if (live.isPaused) {
    return (
      <span
        style={{
          borderRadius: 5,
          border: "1px solid #e7e3dd",
          background: "#f5f2ed",
          color: "#6a665f",
          padding: "2px 7px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        PAUSED
      </span>
    );
  }
  if (live.connectionStatus === "connected") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          borderRadius: 5,
          background: "#1c1b19",
          color: "#fff",
          padding: "2px 7px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        <span
          className="k-pulse"
          style={{ height: 5, width: 5, borderRadius: "50%", background: "#fff" }}
        />
        LIVE
      </span>
    );
  }
  const label =
    live.connectionStatus === "connecting"
      ? "CONNECTING"
      : live.connectionStatus === "failed"
        ? "FAILED"
        : "OFFLINE";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 5,
        border: "1px solid #e7e3dd",
        background: "#f5f2ed",
        color: "#6a665f",
        padding: "2px 7px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {live.connectionStatus === "connecting" && (
        <span
          className="k-pulse"
          style={{ height: 5, width: 5, borderRadius: "50%", background: "#9a958c" }}
        />
      )}
      {label}
    </span>
  );
}

export default function SessionView({
  session,
  computerName,
  live,
  computer,
}: {
  session: Session;
  computerName: string;
  live: LiveSessionData;
  computer?: Computer;
}) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState("");

  const sessionEnded = session.state === "complete" || session.state === "failed";

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch(
      sessionMessageAdded(session.id, {
        id: newId("msg"),
        who: "You",
        side: "user",
        text,
        at: nowIso(),
      }),
    );
    setDraft("");
    if (computer) {
      void sendSessionMessage({ sessionId: session.id, computerId: computer.id, text, access: computer.access }).catch((error: unknown) => {
        dispatch(sessionMessageAdded(session.id, { id: newId("msg"), who: "Kylian", side: "agent", text: `The backend could not accept that message: ${error instanceof Error ? error.message : "Unknown error"}`, at: nowIso() }));
      });
    }
  };

  const stop = () => {
    dispatch(
      sessionUpdated(session.id, {
        state: "complete",
        status: "Stopped",
        detail: "Stopped by you",
      }),
    );
    dispatch(liveConnectionChanged(session.id, "disconnected"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top bar */}
      <header
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          borderBottom: "1px solid #e7e3dd",
          background: "#faf9f7",
          padding: "0 18px",
          height: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <Link
            to="/dashboard"
            className="k-ctrl"
            style={{
              display: "flex",
              height: 30,
              width: 30,
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #e7e3dd",
              borderRadius: 7,
              background: "#fff",
              color: "#6a665f",
              fontSize: 15,
              flex: "none",
              transition: "all .12s",
            }}
          >
            ←
          </Link>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {session.name}
              </span>
              <StatusBadge live={live} />
            </div>
            <span style={{ fontSize: 11.5, color: "#9a958c" }}>
              {computerName} · Session {session.id.slice(-6).toUpperCase()}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => dispatch(sessionPausedChanged(session.id, !live.isPaused))}
            className="k-ctrl"
            style={ctrlButtonStyle}
          >
            {live.isPaused ? "Resume" : "Pause"}
          </button>
          <button className="k-ctrl" style={ctrlButtonStyle}>
            Take control
          </button>
          <button
            onClick={() => dispatch(sessionMutedChanged(session.id, !live.isMuted))}
            className="k-ctrl"
            style={ctrlButtonStyle}
          >
            {live.isMuted ? "Unmute voice" : "Mute voice"}
          </button>
          <button
            className="k-stop"
            onClick={stop}
            disabled={sessionEnded}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "none",
              borderRadius: 7,
              background: "#a33a2e",
              color: "#fff",
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: sessionEnded ? "default" : "pointer",
              opacity: sessionEnded ? 0.45 : 1,
              transition: "background .12s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            {sessionEnded ? "Stopped" : "Stop"}
          </button>
        </div>
      </header>

      <div
        className="k-session"
        style={{ display: "grid", gridTemplateColumns: "1fr 384px", flex: 1, minHeight: 0 }}
      >
        <LiveFeed live={live} />

        {/* Right panel */}
        <aside
          className="k-panel"
          style={{
            borderLeft: "1px solid #e7e3dd",
            background: "#faf9f7",
            overflowY: "auto",
            minHeight: 0,
            padding: 0,
          }}
        >
          <ConversationPanel
            messages={live.messages}
            draft={draft}
            onDraft={setDraft}
            onSend={send}
          />
          <ActivityTimeline events={live.activity} />
          <CandidateFiles
            candidates={live.candidates}
            selectedId={live.selectedCandidateId}
            onSelect={(candidateId) => dispatch(candidateSelected(session.id, candidateId))}
          />
          <ApprovalCard
            approval={live.approval}
            onResolve={(approved) => dispatch(approvalResolved(session.id, approved))}
          />
        </aside>
      </div>
    </div>
  );
}
