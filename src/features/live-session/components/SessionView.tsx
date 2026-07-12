import { Link } from "react-router-dom";
import LiveFeed from "./LiveFeed";
import ConversationPanel from "./ConversationPanel";
import type { Session } from "@/features/sessions/types";
import type { LiveSessionData } from "@/features/live-session/types";

function StatusBadge({ live }: { live: LiveSessionData }) {
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
}: {
  session: Session;
  computerName: string;
  live: LiveSessionData;
}) {
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
            to="/sessions"
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
          <ConversationPanel messages={live.messages} />
        </aside>
      </div>
    </div>
  );
}
