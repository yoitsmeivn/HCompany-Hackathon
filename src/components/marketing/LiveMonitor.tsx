import { useEffect, useRef, useState, type ReactNode } from "react";
import LiveFeed from "@/features/live-session/components/LiveFeed";
import { emptyLiveSession } from "@/store/initialState";
import { useAppDispatch, useAppState } from "@/store/context";
import { liveConnectionChanged, liveSessionInitialized } from "@/store/actions";
import { subscribeToMonitor } from "@/services/monitorService";
import { subscribeToSessionEvents } from "@/services/orchestrationService";
import { applyRuntimeEvent } from "@/integrations/runtimeEvents";

interface ActiveCall {
  sessionId: string;
  from?: string;
}

// Turns the landing page into a live monitor. It watches the global call
// lifecycle stream and, while a call is active, renders the real desktop
// screenshot + transcript + activity (all from the existing SSE runtime-event
// pipeline). When idle it shows the marketing preview passed as `fallback`.
export default function LiveMonitor({ fallback }: { fallback: ReactNode }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [active, setActive] = useState<ActiveCall | null>(null);

  // Dedupe repeated/replayed call-started envelopes for the same session.
  const started = useRef(new Set<string>());

  // Monitor stream. Unlike the in-app dashboard we deliberately process the
  // replay burst too, so refreshing mid-call restores the live view: the burst
  // arrives oldest→newest, so a call that already ended nets out to cleared.
  useEffect(() => {
    return subscribeToMonitor(({ event }) => {
      if (event.kind === "call-ended") {
        setActive((current) => (current?.sessionId === event.sessionId ? null : current));
        dispatch(liveConnectionChanged(event.sessionId, "disconnected"));
        return;
      }
      if (event.kind !== "call-started") return;
      setActive({ sessionId: event.sessionId, from: event.from });
      if (!started.current.has(event.sessionId)) {
        started.current.add(event.sessionId);
        dispatch(liveSessionInitialized(event.sessionId));
        dispatch(liveConnectionChanged(event.sessionId, "connected"));
      }
    });
  }, [dispatch]);

  // Subscribe to the active session's runtime events (transcript, activity,
  // status, screen-frame). The server replays its buffer + newest frame on
  // connect, so a fresh mount immediately shows the latest desktop state.
  const activeSessionId = active?.sessionId;
  useEffect(() => {
    if (!activeSessionId) return;
    const seen = new Set<string>();
    return subscribeToSessionEvents(activeSessionId, (envelope) => {
      if (seen.has(envelope.id)) return;
      seen.add(envelope.id);
      applyRuntimeEvent(dispatch, envelope);
    });
  }, [activeSessionId, dispatch]);

  if (!active) return <>{fallback}</>;

  const live = state.live[active.sessionId] ?? emptyLiveSession();
  const title = active.from ? `Call from ${active.from}` : "Live call";
  const recentActivity = live.activity.slice(-4);
  const recentMessages = live.messages.slice(-3);

  return (
    <div className="k-rise" style={{ position: "relative" }}>
      <div
        style={{
          borderRadius: 9,
          border: "1px solid #e7e3dd",
          background: "#fff",
          boxShadow: "0 4px 24px rgba(28,27,25,0.07),0 1px 3px rgba(28,27,25,0.05)",
          overflow: "hidden",
        }}
      >
        {/* Browser chrome header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            borderBottom: "1px solid #f0ece6",
            padding: "11px 14px",
            background: "#faf9f7",
          }}
        >
          <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#e0dcd4" }} />
          <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#e0dcd4" }} />
          <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#e0dcd4" }} />
          <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 500, color: "#9a958c" }}>{title}</span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: live.connectionStatus === "connected" ? "#1c1b19" : "#9a958c",
            }}
          >
            <span
              className={live.connectionStatus === "connected" ? "k-pulse" : undefined}
              style={{
                height: 6,
                width: 6,
                borderRadius: "50%",
                background: live.connectionStatus === "connected" ? "#1c1b19" : "#c2bdb2",
              }}
            />
            {live.connectionStatus === "connected" ? "LIVE" : "CONNECTING"}
          </span>
        </div>

        {/* Desktop screenshot | activity + transcript */}
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr" }}>
          <div style={{ display: "grid", minHeight: 236, borderRight: "1px solid #f0ece6" }}>
            <LiveFeed live={live} />
          </div>
          <div style={{ padding: "12px 13px", display: "grid", gap: 12, alignContent: "start" }}>
            <div>
              <p
                style={{
                  margin: "0 0 7px",
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#9a958c",
                }}
              >
                Activity
              </p>
              <div style={{ display: "grid", gap: 7 }}>
                {recentActivity.length === 0 ? (
                  <span style={{ fontSize: 11, color: "#9a958c" }}>Waiting for the agent…</span>
                ) : (
                  recentActivity.map((event) => (
                    <div key={event.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span
                        style={{
                          marginTop: 4,
                          height: 5,
                          width: 5,
                          borderRadius: "50%",
                          background: event.state === "done" ? "#1c1b19" : "transparent",
                          border: event.state === "done" ? "none" : "1.5px solid #c2bdb2",
                          flex: "none",
                        }}
                      />
                      <span style={{ fontSize: 11, color: event.state === "done" ? "#3a382f" : "#6a665f" }}>
                        {event.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            {recentMessages.length > 0 && (
              <div
                style={{
                  borderRadius: 7,
                  border: "1px solid #e7e3dd",
                  background: "#faf9f7",
                  padding: 10,
                  display: "grid",
                  gap: 6,
                }}
              >
                {recentMessages.map((message) => (
                  <p
                    key={message.id}
                    style={{
                      margin: 0,
                      fontSize: 11,
                      lineHeight: 1.45,
                      color: message.side === "agent" ? "#3a382f" : "#6a665f",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{message.side === "agent" ? "Kylian" : "You"}:</span>{" "}
                    {message.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
