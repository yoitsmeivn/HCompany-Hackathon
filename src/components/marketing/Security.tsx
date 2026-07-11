import { Link } from "react-router-dom";

const GUARANTEES = [
  {
    title: "Access you choose",
    body: "Full access, selected access, or ask every time — you decide.",
  },
  {
    title: "Live oversight",
    body: "Follow every action on screen, in real time.",
  },
  {
    title: "Approval gates",
    body: "Sending or changing files waits for your explicit yes.",
  },
  {
    title: "Temporary links",
    body: "Files arrive through links that expire on their own.",
  },
];

export default function Security() {
  return (
    <section id="security" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 28px" }}>
      <div
        className="k-sec-grid"
        style={{
          display: "grid",
          gap: 48,
          gridTemplateColumns: "0.9fr 1.1fr",
          alignItems: "center",
        }}
      >
        <div>
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
            Built for private access
          </p>
          <h2
            style={{
              margin: "12px 0 0",
              fontSize: 30,
              lineHeight: 1.14,
              letterSpacing: "-0.02em",
              fontWeight: 600,
            }}
          >
            Access you can see, and stop.
          </h2>
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: 420,
              fontSize: 14.5,
              lineHeight: 1.6,
              color: "#6a665f",
            }}
          >
            Kylian only reaches what you allow, on the computer running your local companion.
            Every session is visible, every sensitive action asks first.
          </p>
          <Link
            to="/setup"
            style={{
              marginTop: 26,
              display: "inline-block",
              borderRadius: 6,
              background: "#1c1b19",
              color: "#fff",
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Start a demo
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gap: 1,
            background: "#e7e3dd",
            border: "1px solid #e7e3dd",
            borderRadius: 9,
            overflow: "hidden",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {GUARANTEES.map((g) => (
            <div key={g.title} style={{ background: "#fff", padding: 22 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600 }}>{g.title}</h3>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#6a665f" }}>
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
