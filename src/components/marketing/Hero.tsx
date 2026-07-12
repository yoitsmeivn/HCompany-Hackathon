import { Link } from "react-router-dom";
import LiveMonitor from "./LiveMonitor";

function SessionPreview() {
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
          <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 500, color: "#9a958c" }}>
            Ivan&rsquo;s MacBook Pro
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 500,
              color: "#3a382f",
            }}
          >
            <span style={{ height: 6, width: 6, borderRadius: "50%", background: "#1c1b19" }} />
            Connected
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr" }}>
          <div
            style={{
              position: "relative",
              background: "#eceae4",
              borderRight: "1px solid #f0ece6",
              minHeight: 236,
              backgroundImage:
                "repeating-linear-gradient(135deg,#e7e4dd 0 1px,transparent 1px 9px)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 14,
                top: 14,
                right: 14,
                borderRadius: 7,
                background: "#fff",
                border: "1px solid #e7e3dd",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderBottom: "1px solid #f0ece6",
                  background: "#f7f5f0",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3a382f" }}>
                  Documents › Pitch Decks
                </span>
              </div>
              <div style={{ padding: "8px 10px", display: "grid", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 7px",
                    borderRadius: 5,
                    background: "#f2efe9",
                  }}
                >
                  <span
                    style={{
                      height: 14,
                      width: 11,
                      borderRadius: 2,
                      border: "1px solid #cfcabf",
                      background: "#fff",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#3a382f" }}>
                    Soar_Investor_Deck_Jul10.pptx
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px" }}
                >
                  <span
                    style={{
                      height: 14,
                      width: 11,
                      borderRadius: 2,
                      border: "1px solid #cfcabf",
                      background: "#fff",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#6a665f" }}>Soar_YC_Deck_Final.pdf</span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px" }}
                >
                  <span
                    style={{
                      height: 14,
                      width: 11,
                      borderRadius: 2,
                      border: "1px solid #cfcabf",
                      background: "#fff",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#6a665f" }}>Soar_Final_Final2.pptx</span>
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                right: 14,
                borderRadius: 7,
                background: "rgba(28,27,25,0.9)",
                backdropFilter: "blur(4px)",
                padding: "9px 11px",
                color: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#b7b2a8",
                  }}
                >
                  Current action
                </span>
                <span style={{ fontSize: 10, fontWeight: 500, color: "#c9c4ba" }}>Read only</span>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.4 }}>
                Opening Documents / Pitch Decks
              </p>
            </div>
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
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      marginTop: 4,
                      height: 5,
                      width: 5,
                      borderRadius: "50%",
                      background: "#1c1b19",
                      flex: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#3a382f" }}>Authenticated caller</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      marginTop: 4,
                      height: 5,
                      width: 5,
                      borderRadius: "50%",
                      background: "#1c1b19",
                      flex: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#3a382f" }}>Searched allowed folders</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      marginTop: 4,
                      height: 5,
                      width: 5,
                      borderRadius: "50%",
                      border: "1.5px solid #c2bdb2",
                      background: "#fff",
                      flex: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#6a665f" }}>Found matching slide</span>
                </div>
              </div>
            </div>
            <div
              style={{
                borderRadius: 7,
                border: "1px solid #e7e3dd",
                background: "#faf9f7",
                padding: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "#3a382f" }}>
                Ready to send <span style={{ fontWeight: 600 }}>Soar_Investor_Deck_Jul10.pptx</span>{" "}
                to your device.
              </p>
              <div style={{ marginTop: 9, display: "flex", gap: 6 }}>
                <span
                  style={{
                    flex: 1,
                    textAlign: "center",
                    borderRadius: 5,
                    background: "#1c1b19",
                    color: "#fff",
                    padding: 6,
                    fontSize: 10.5,
                    fontWeight: 500,
                  }}
                >
                  Approve &amp; send
                </span>
                <span
                  style={{
                    textAlign: "center",
                    borderRadius: 5,
                    border: "1px solid #e7e3dd",
                    background: "#fff",
                    color: "#6a665f",
                    padding: "6px 10px",
                    fontSize: 10.5,
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section style={{ borderBottom: "1px solid #e7e3dd", background: "#ffffff" }}>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "76px 28px 84px",
          display: "grid",
          gap: 56,
          alignItems: "center",
          gridTemplateColumns: "1fr",
        }}
      >
        <div
          className="k-hero-grid"
          style={{
            display: "grid",
            gap: 56,
            alignItems: "center",
            gridTemplateColumns: "1.05fr 0.95fr",
          }}
        >
          <div>
            <p
              className="k-rise"
              style={{
                margin: "0 0 20px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 6,
                border: "1px solid #e7e3dd",
                background: "#f5f2ed",
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "#6a665f",
              }}
            >
              <span style={{ height: 6, width: 6, borderRadius: "50%", background: "#1c1b19" }} />
              Secure remote computer assistant
            </p>
            <h1
              className="k-rise"
              style={{
                margin: 0,
                maxWidth: 560,
                fontSize: 50,
                lineHeight: 1.06,
                letterSpacing: "-0.025em",
                fontWeight: 600,
              }}
            >
              Your computer, available wherever you are.
            </h1>
            <p
              className="k-rise"
              style={{
                margin: "22px 0 0",
                maxWidth: 480,
                fontSize: 16.5,
                lineHeight: 1.6,
                color: "#6a665f",
              }}
            >
              Call or message Kylian to find files, operate applications, and securely access the
              computer you left behind.
            </p>
            <div
              className="k-rise"
              style={{
                marginTop: 32,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Link
                to="/onboarding"
                style={{
                  borderRadius: 6,
                  background: "#1c1b19",
                  color: "#fff",
                  padding: "11px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Start a demo
              </Link>
              <a
                href="#how"
                style={{
                  borderRadius: 6,
                  border: "1px solid #e7e3dd",
                  background: "#fff",
                  padding: "11px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#3a382f",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                See how it works
              </a>
            </div>
          </div>

          <LiveMonitor fallback={<SessionPreview />} />
        </div>
      </div>
    </section>
  );
}
