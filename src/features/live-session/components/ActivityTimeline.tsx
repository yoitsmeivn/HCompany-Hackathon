import type { ActivityEvent } from "@/features/live-session/types";
import { formatRelative } from "@/lib/time";

export default function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <section style={{ padding: 18, borderBottom: "1px solid #e7e3dd" }}>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#9a958c",
        }}
      >
        Agent activity
      </p>
      {events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>
          Agent activity will appear here as Kylian works.
        </p>
      ) : (
        <div style={{ position: "relative", display: "grid", gap: 0 }}>
          {events.map((event, i) => {
            const showLine = i !== events.length - 1;
            return (
              <div
                key={event.id}
                style={{ display: "flex", gap: 11, paddingBottom: 14, position: "relative" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: "none",
                    width: 15,
                  }}
                >
                  {event.state === "done" && (
                    <span
                      style={{
                        height: 15,
                        width: 15,
                        borderRadius: "50%",
                        background: "#1c1b19",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                      }}
                    >
                      ✓
                    </span>
                  )}
                  {event.state === "current" && (
                    <span
                      className="k-pulse"
                      style={{
                        height: 15,
                        width: 15,
                        borderRadius: "50%",
                        border: "2px solid #1c1b19",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                  )}
                  {showLine && (
                    <span style={{ flex: 1, width: 1.5, background: "#e2ded6", marginTop: 3 }} />
                  )}
                </div>
                <div style={{ paddingTop: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      fontWeight: event.state === "current" ? 600 : 450,
                      color: "#1c1b19",
                    }}
                  >
                    {event.label}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9a958c" }}>
                    {event.state === "pending" ? "—" : formatRelative(event.at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
