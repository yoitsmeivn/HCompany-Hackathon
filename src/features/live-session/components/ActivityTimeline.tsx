const ACTIVITY = [
  { label: "Received request by phone", time: "10:38", done: true, current: false },
  { label: "Authenticated caller", time: "10:38", done: true, current: false },
  { label: "Searched allowed folders", time: "10:39", done: true, current: false },
  { label: "Opened two candidate files", time: "10:41", done: true, current: false },
  { label: "Comparing versions", time: "Now", done: false, current: true },
  { label: "Waiting for approval", time: "—", done: false, current: false },
];

export default function ActivityTimeline() {
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
      <div style={{ position: "relative", display: "grid", gap: 0 }}>
        {ACTIVITY.map((a, i) => {
          const showLine = i !== ACTIVITY.length - 1;
          return (
            <div
              key={a.label}
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
                {a.done && (
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
                {a.current && (
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
                    fontWeight: a.current ? 600 : 450,
                    color: "#1c1b19",
                  }}
                >
                  {a.label}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9a958c" }}>{a.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
