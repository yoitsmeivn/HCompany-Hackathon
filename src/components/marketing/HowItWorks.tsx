const STEPS = [
  {
    number: "01",
    title: "You reach out",
    body: "Call or text Kylian and describe the task.",
  },
  {
    number: "02",
    title: "It gets to work",
    body: "The agent operates your computer within the access you allow.",
  },
  {
    number: "03",
    title: "You stay in control",
    body: "Watch live, add instructions, pause or stop anytime.",
  },
  {
    number: "04",
    title: "You receive it",
    body: "Approve the result and get it via a secure link.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" style={{ borderTop: "1px solid #e7e3dd", background: "#ffffff" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 28px" }}>
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
          How it works
        </p>
        <h2
          style={{
            margin: "12px 0 0",
            fontSize: 32,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            fontWeight: 600,
          }}
        >
          Four steps, fully in view.
        </h2>
        <div
          className="k-steps-grid"
          style={{
            marginTop: 44,
            display: "grid",
            gap: 28,
            gridTemplateColumns: "repeat(4,1fr)",
          }}
        >
          {STEPS.map((s) => (
            <div key={s.number} style={{ borderTop: "1px solid #1c1b19", paddingTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#9a958c" }}>{s.number}</span>
              <h3 style={{ margin: "10px 0 6px", fontSize: 15, fontWeight: 600 }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#6a665f" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
