export default function LiveFeed({ paused }: { paused: boolean }) {
  const feedOpacity = paused ? 0.55 : 1;

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
          background: "linear-gradient(155deg,#d8c9b4 0%,#c8b6a0 45%,#9c8f88 100%)",
        }}
      >
        {/* macOS menubar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            height: 26,
            padding: "0 12px",
            background: "rgba(250,249,247,0.72)",
            backdropFilter: "blur(12px)",
            fontSize: 11.5,
            color: "#1c1b19",
          }}
        >
          <span style={{ fontWeight: 600 }}></span>
          <span style={{ fontWeight: 600 }}>Finder</span>
          <span style={{ color: "#3a382f" }}>File</span>
          <span style={{ color: "#3a382f" }}>Edit</span>
          <span style={{ color: "#3a382f" }}>View</span>
          <span style={{ color: "#3a382f" }}>Go</span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#3a382f",
            }}
          >
            <span>􀙇</span>
            <span>􀊫</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>10:42</span>
          </span>
        </div>

        {/* Finder window */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 52,
            width: "min(66%,420px)",
            borderRadius: 9,
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
            background: "#fff",
            transition: "opacity .2s",
            opacity: feedOpacity,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 12px",
              background: "#efece7",
              borderBottom: "1px solid #e2ded6",
            }}
          >
            <span style={{ height: 11, width: 11, borderRadius: "50%", background: "#e5695c" }} />
            <span style={{ height: 11, width: 11, borderRadius: "50%", background: "#e5c05c" }} />
            <span style={{ height: 11, width: 11, borderRadius: "50%", background: "#83c463" }} />
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "#3a382f" }}>
              Documents
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "118px 1fr" }}>
            <div
              style={{
                background: "#f5f3ee",
                borderRight: "1px solid #eee9e1",
                padding: "10px 8px",
                display: "grid",
                gap: 3,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#a8a297",
                  padding: "0 5px 3px",
                }}
              >
                Favorites
              </span>
              <span style={{ fontSize: 11, color: "#6a665f", padding: "4px 6px", borderRadius: 5 }}>
                Desktop
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#1c1b19",
                  padding: "4px 6px",
                  borderRadius: 5,
                  background: "#e5e0d6",
                  fontWeight: 500,
                }}
              >
                Documents
              </span>
              <span style={{ fontSize: 11, color: "#6a665f", padding: "4px 6px", borderRadius: 5 }}>
                Downloads
              </span>
              <span style={{ fontSize: 11, color: "#6a665f", padding: "4px 6px", borderRadius: 5 }}>
                Projects
              </span>
            </div>
            <div style={{ padding: 8, display: "grid", gap: 3 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "#e9e4da",
                  border: "1px solid #ddd6c9",
                }}
              >
                <span style={{ height: 18, width: 14, borderRadius: 2, background: "#c96f5e" }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#1c1b19" }}>
                  Resume_Ivan_2026.pdf
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px",
                  borderRadius: 6,
                }}
              >
                <span style={{ height: 18, width: 14, borderRadius: 2, background: "#5e7bc9" }} />
                <span style={{ fontSize: 11.5, color: "#3a382f" }}>Resume_Ivan_technical.pdf</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px",
                  borderRadius: 6,
                }}
              >
                <span style={{ height: 18, width: 14, borderRadius: 2, background: "#8a8378" }} />
                <span style={{ fontSize: 11.5, color: "#3a382f" }}>Resume_old_v3.docx</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px",
                  borderRadius: 6,
                }}
              >
                <span style={{ height: 18, width: 14, borderRadius: 2, background: "#8a8378" }} />
                <span style={{ fontSize: 11.5, color: "#3a382f" }}>CoverLetter_generic.docx</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview window */}
        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 78,
            width: "min(46%,270px)",
            borderRadius: 9,
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
            background: "#fff",
            transition: "opacity .2s",
            opacity: feedOpacity,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 32,
              padding: "0 12px",
              background: "#efece7",
              borderBottom: "1px solid #e2ded6",
            }}
          >
            <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#e5695c" }} />
            <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#e5c05c" }} />
            <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#83c463" }} />
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "#3a382f" }}>
              Preview — Resume_Ivan_2026.pdf
            </span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ height: 9, width: "52%", borderRadius: 2, background: "#2c2a26", marginBottom: 9 }} />
            <div style={{ height: 5, width: "36%", borderRadius: 2, background: "#c9c3b8", marginBottom: 12 }} />
            <div style={{ height: 4, width: "92%", borderRadius: 2, background: "#e6e1d7", marginBottom: 5 }} />
            <div style={{ height: 4, width: "88%", borderRadius: 2, background: "#e6e1d7", marginBottom: 5 }} />
            <div style={{ height: 4, width: "70%", borderRadius: 2, background: "#e6e1d7", marginBottom: 12 }} />
            <div style={{ height: 5, width: "30%", borderRadius: 2, background: "#c9c3b8", marginBottom: 8 }} />
            <div style={{ height: 4, width: "80%", borderRadius: 2, background: "#e6e1d7", marginBottom: 5 }} />
            <div style={{ height: 4, width: "64%", borderRadius: 2, background: "#e6e1d7" }} />
          </div>
        </div>

        {/* HUD overlay */}
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
                <span style={{ width: 2.5, height: 11, background: "#c9c4ba", borderRadius: 1 }} />
              </span>
              Good connection
            </span>
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 64, fontSize: 10.5, color: "#8f8a80", flex: "none" }}>Task</span>
              <span style={{ fontSize: 11.5, color: "#f2efe9" }}>Find latest technical resume</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 64, fontSize: 10.5, color: "#8f8a80", flex: "none" }}>
                Current app
              </span>
              <span style={{ fontSize: 11.5, color: "#f2efe9" }}>Finder</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 64, fontSize: 10.5, color: "#8f8a80", flex: "none" }}>Action</span>
              <span style={{ fontSize: 11.5, color: "#f2efe9" }}>
                Comparing 2 most recent versions
              </span>
            </div>
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
                  Read only
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
