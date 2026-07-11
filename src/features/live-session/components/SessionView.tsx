import { useState } from "react";
import { Link } from "react-router-dom";
import LiveFeed from "./LiveFeed";
import ConversationPanel from "./ConversationPanel";
import ActivityTimeline from "./ActivityTimeline";
import CandidateFiles from "./CandidateFiles";
import ApprovalCard from "./ApprovalCard";
import type { Message } from "@/features/live-session/types";

const SEED_MESSAGES: Message[] = [
  {
    who: "You",
    side: "user",
    text: "Find the newest technical resume — the detailed one, not the short version.",
  },
  {
    who: "Kylian",
    side: "agent",
    text: "I found three likely files. I’m opening the two most recent versions to compare.",
  },
  {
    who: "Kylian",
    side: "agent",
    text: "Resume_Ivan_2026.pdf looks like the detailed one — it has the full project history. Want me to send it?",
  },
];

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

export default function SessionView({
  title = "Retrieve technical resume",
  subtitle = "Ivan’s MacBook Pro · Session #A24-7F",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { who: "You", side: "user", text }]);
    setDraft("");
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
                {title}
              </span>
              {!paused ? (
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
              ) : (
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
              )}
            </div>
            <span style={{ fontSize: 11.5, color: "#9a958c" }}>{subtitle}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setPaused((p) => !p)} className="k-ctrl" style={ctrlButtonStyle}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="k-ctrl" style={ctrlButtonStyle}>
            Take control
          </button>
          <button onClick={() => setMuted((m) => !m)} className="k-ctrl" style={ctrlButtonStyle}>
            {muted ? "Unmute voice" : "Mute voice"}
          </button>
          <button
            className="k-stop"
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
              cursor: "pointer",
              transition: "background .12s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            Stop
          </button>
        </div>
      </header>

      <div
        className="k-session"
        style={{ display: "grid", gridTemplateColumns: "1fr 384px", flex: 1, minHeight: 0 }}
      >
        <LiveFeed paused={paused} />

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
          <ConversationPanel messages={messages} draft={draft} onDraft={setDraft} onSend={send} />
          <ActivityTimeline />
          <CandidateFiles selected={selected} onSelect={setSelected} />
          <ApprovalCard approved={approved} onApprove={() => setApproved(true)} />
        </aside>
      </div>
    </div>
  );
}
