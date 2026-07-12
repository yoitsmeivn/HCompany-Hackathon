const FEATURES = [
  {
    icon: "☎",
    title: "Call or message",
    body: "Reach Kylian by phone, WhatsApp, or chat. Ask in plain language for what you need.",
  },
  {
    icon: "◱",
    title: "Watch it work",
    body: "Open a live session to see the screen, follow each action, and steer with voice or text.",
  },
  {
    icon: "⛨",
    title: "Approve & receive",
    body: "Sensitive actions wait for you. Approve, and the file arrives through a secure temporary link.",
  },
];

export default function Features() {
  return (
    <section id="product" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 28px" }}>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#9a958c",
        }}
      >
        What it does
      </p>
      <h2
        style={{
          margin: "12px 0 0",
          maxWidth: 640,
          fontSize: 32,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          fontWeight: 600,
        }}
      >
        A quiet operator for the machine you had to leave behind.
      </h2>
      <div
        className="k-feat-grid"
        style={{
          marginTop: 44,
          display: "grid",
          gap: 1,
          background: "#e7e3dd",
          border: "1px solid #e7e3dd",
          borderRadius: 9,
          overflow: "hidden",
          gridTemplateColumns: "repeat(3,1fr)",
        }}
      >
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: "#fff", padding: "26px 24px" }}>
            <div
              style={{
                height: 30,
                width: 30,
                borderRadius: 7,
                border: "1px solid #e7e3dd",
                background: "#f5f2ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              {f.icon}
            </div>
            <h3 style={{ margin: "16px 0 6px", fontSize: 15.5, fontWeight: 600 }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#6a665f" }}>
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
