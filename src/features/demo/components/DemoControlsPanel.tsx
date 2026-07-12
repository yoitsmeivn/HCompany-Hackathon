import { useState, type CSSProperties } from "react";
import { useAppDispatch, useAppState } from "@/store/context";
import { applyRuntimeEvent, type RuntimeEvent } from "@/integrations/runtimeEvents";
import { demoControlsEnabled } from "../demoControlsGate";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
  marginBottom: 5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--k-border)",
  borderRadius: 6,
  background: "var(--k-surface)",
  padding: "7px 9px",
  fontSize: 12,
  fontFamily: "inherit",
};

const buttonStyle: CSSProperties = {
  border: "1px solid var(--k-border)",
  borderRadius: 6,
  background: "var(--k-surface)",
  padding: "6px 10px",
  fontSize: 11.5,
  fontWeight: 500,
  color: "var(--k-ink-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all .12s",
};

// Development/integration-testing panel. Hidden unless enabled via
// VITE_ENABLE_DEMO_CONTROLS=true or ?demoControls=1. Every control goes
// through applyRuntimeEvent — the exact path Twilio/Gradium, H Company,
// WebRTC, and the future backend will use.
export default function DemoControlsPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [computerId, setComputerId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [text, setText] = useState("");

  if (!demoControlsEnabled()) return null;

  const targetComputer = computerId || state.computers[0]?.id || "";
  const targetSession = sessionId || state.sessions[0]?.id || "";

  const emit = (event: RuntimeEvent) =>
    applyRuntimeEvent(dispatch, { id: newId("demo"), at: nowIso(), event });
  const withText = (fn: (value: string) => void, fallback: string) => {
    fn(text.trim() || fallback);
    setText("");
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 100,
        width: open ? 280 : "auto",
        borderRadius: 10,
        border: "1px solid var(--k-border)",
        background: "var(--k-surface)",
        boxShadow: "0 8px 26px rgba(28,27,25,0.14)",
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          border: "none",
          background: "var(--k-bg)",
          padding: "9px 12px",
          fontSize: 11.5,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          color: "var(--k-ink)",
        }}
      >
        Demo controls
        <span style={{ color: "var(--k-faint)" }}>{open ? "▾" : "▴"}</span>
      </button>

      {open && (
        <div
          style={{
            padding: 12,
            display: "grid",
            gap: 12,
            borderTop: "1px solid var(--k-border-soft)",
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          <div>
            <label style={labelStyle}>Computer</label>
            <select
              value={targetComputer}
              onChange={(e) => setComputerId(e.target.value)}
              style={inputStyle}
            >
              {state.computers.length === 0 && <option value="">No computers</option>}
              {state.computers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
              <button
                style={buttonStyle}
                disabled={!targetComputer}
                onClick={() =>
                  emit({ kind: "companion-status", computerId: targetComputer, status: "connected" })
                }
              >
                Companion connected
              </button>
              <button
                style={buttonStyle}
                disabled={!targetComputer}
                onClick={() =>
                  emit({ kind: "companion-status", computerId: targetComputer, status: "offline" })
                }
              >
                Disconnected
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Session</label>
            <select
              value={targetSession}
              onChange={(e) => setSessionId(e.target.value)}
              style={inputStyle}
            >
              {state.sessions.length === 0 && <option value="">No sessions</option>}
              {state.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.state})
                </option>
              ))}
            </select>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Text for message / event / file…"
              style={{ ...inputStyle, marginTop: 7 }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  withText(
                    (value) => emit({ kind: "agent-message", sessionId: targetSession, text: value }),
                    "Agent message",
                  )
                }
              >
                Agent message
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  withText(
                    (value) => emit({ kind: "computer-action", sessionId: targetSession, label: value }),
                    "Computer action",
                  )
                }
              >
                Activity event
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  withText(
                    (value) =>
                      emit({
                        kind: "candidate-file",
                        sessionId: targetSession,
                        candidate: { name: value, meta: "Added via demo controls", ext: "FILE" },
                      }),
                    "candidate.txt",
                  )
                }
              >
                Candidate file
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  withText(
                    (value) =>
                      emit({
                        kind: "approval-requested",
                        sessionId: targetSession,
                        summary: "Kylian is ready to send a file to your verified device.",
                        fileName: value,
                      }),
                    "document.pdf",
                  )
                }
              >
                Request approval
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  emit({ kind: "approval-resolved", sessionId: targetSession, approved: true })
                }
              >
                Resolve approval
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  emit({
                    kind: "session-state",
                    sessionId: targetSession,
                    state: "complete",
                    status: "Complete",
                    detail: "Marked complete via demo controls",
                  })
                }
              >
                Mark complete
              </button>
              <button
                style={buttonStyle}
                disabled={!targetSession}
                onClick={() =>
                  emit({
                    kind: "session-state",
                    sessionId: targetSession,
                    state: "failed",
                    status: "Failed",
                    detail: "Marked failed via demo controls",
                  })
                }
              >
                Mark failed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
