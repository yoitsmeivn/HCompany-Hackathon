import type { LiveSessionData } from "@/features/live-session/types";

const CONNECTION_MESSAGES: Record<LiveSessionData["connectionStatus"], string> = {
  connecting: "Connecting to your companion…",
  connected: "Waiting for live view from your companion…",
  disconnected: "Live view is disconnected.",
  failed: "Live view could not connect.",
};

const CONNECTION_LABELS: Record<LiveSessionData["connectionStatus"], string> = {
  connecting: "Connecting",
  connected: "Good connection",
  disconnected: "Disconnected",
  failed: "Connection failed",
};

export default function LiveFeed({ live }: { live: LiveSessionData }) {
  const feedOpacity = live.isPaused ? 0.55 : 1;
  const pulsing = live.connectionStatus === "connecting" || live.connectionStatus === "connected";

  return (
    <div
      className="k-feedwrap"
      style={{
        position: "relative",
        background: "#3a3833",
        padding: 16,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
          background: "linear-gradient(155deg,#4a4740 0%,#403d37 45%,#33312c 100%)",
          transition: "opacity .2s",
          opacity: feedOpacity,
        }}
      >
        {/* Placeholder until the companion streams a real screen (WebRTC later) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <span
            className={pulsing ? "k-pulse" : undefined}
            style={{
              height: 9,
              width: 9,
              borderRadius: "50%",
              background: live.connectionStatus === "failed" ? "#c9847a" : "#c9c4ba",
            }}
          />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#e6e1d7" }}>
            {CONNECTION_MESSAGES[live.connectionStatus]}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: "#8f8a80", maxWidth: 340 }}>
            The screen appears here while Kylian works, so you can watch every action and step in
            at any time.
          </p>
        </div>

        {/* HUD overlay — driven by session data */}
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: 18,
            width: "min(60%,340px)",
            borderRadius: 9,
            background: "rgba(28,27,25,0.9)",
            backdropFilter: "blur(10px)",
            color: "#fff",
            padding: "13px 15px",
            boxShadow: "0 8px 26px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 9,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#b7b2a8",
              }}
            >
              Live session
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                color: "#c9c4ba",
              }}
            >
              <span style={{ display: "flex", gap: 1.5, alignItems: "flex-end" }}>
                <span style={{ width: 2.5, height: 5, background: "#c9c4ba", borderRadius: 1 }} />
                <span style={{ width: 2.5, height: 8, background: "#c9c4ba", borderRadius: 1 }} />
                <span
                  style={{
                    width: 2.5,
                    height: 11,
                    background: live.connectionStatus === "connected" ? "#c9c4ba" : "#6f6a61",
                    borderRadius: 1,
                  }}
                />
              </span>
              {CONNECTION_LABELS[live.connectionStatus]}
            </span>
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {(
              [
                ["Task", live.feed?.task],
                ["Current app", live.feed?.currentApp],
                ["Action", live.feed?.action],
              ] as const
            ).map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: 8 }}>
                <span style={{ width: 64, fontSize: 10.5, color: "#8f8a80", flex: "none" }}>
                  {label}
                </span>
                <span style={{ fontSize: 11.5, color: "#f2efe9" }}>{value ?? "—"}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 64, fontSize: 10.5, color: "#8f8a80", flex: "none" }}>
                Permission
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "#f2efe9",
                }}
              >
                <span
                  style={{
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}
                >
                  {live.feed?.permission ?? "—"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
