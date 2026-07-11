const CANDIDATES = [
  {
    name: "Resume_Ivan_2026.pdf",
    meta: "PDF · Modified today · 248 KB",
    ext: "PDF",
    iconBg: "#c96f5e",
    evidence: "Matches “technical” — full project history, 3 pages.",
  },
  {
    name: "Resume_Ivan_technical.pdf",
    meta: "PDF · Modified Jun 28 · 214 KB",
    ext: "PDF",
    iconBg: "#5e7bc9",
    evidence: "Older detailed version.",
  },
  {
    name: "Resume_old_v3.docx",
    meta: "DOCX · Modified May 12 · 96 KB",
    ext: "DOC",
    iconBg: "#8a8378",
    evidence: "",
  },
];

export default function CandidateFiles({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section style={{ padding: 18, borderBottom: "1px solid #e7e3dd" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#9a958c",
          }}
        >
          Candidate files
        </p>
        <span style={{ fontSize: 11, color: "#9a958c" }}>3 found</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {CANDIDATES.map((c, i) => {
          const sel = selected === i;
          return (
            <div
              key={c.name}
              style={{
                border: `1px solid ${sel ? "#1c1b19" : "#e7e3dd"}`,
                borderRadius: 9,
                background: sel ? "#f7f5f0" : "#fff",
                padding: 12,
                transition: "all .12s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span
                  style={{
                    flex: "none",
                    height: 30,
                    width: 24,
                    borderRadius: 3,
                    background: c.iconBg,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 3,
                    fontSize: 7,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {c.ext}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#1c1b19",
                      wordBreak: "break-word",
                    }}
                  >
                    {c.name}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9a958c" }}>{c.meta}</p>
                </div>
              </div>
              {c.evidence && (
                <p
                  style={{
                    margin: "9px 0 0",
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: "#6a665f",
                    borderLeft: "2px solid #d7d2c8",
                    paddingLeft: 9,
                  }}
                >
                  {c.evidence}
                </p>
              )}
              <div style={{ marginTop: 11, display: "flex", gap: 7 }}>
                <button
                  className="k-ghost"
                  style={{
                    flex: 1,
                    border: "1px solid #e7e3dd",
                    borderRadius: 6,
                    background: "#fff",
                    padding: 7,
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "#6a665f",
                    cursor: "pointer",
                    transition: "all .12s",
                  }}
                >
                  Preview
                </button>
                <button
                  onClick={() => onSelect(i)}
                  style={{
                    flex: 1,
                    borderRadius: 6,
                    padding: 7,
                    fontSize: 11.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all .12s",
                    background: sel ? "#1c1b19" : "#fff",
                    color: sel ? "#fff" : "#3a382f",
                    border: `1px solid ${sel ? "#1c1b19" : "#e7e3dd"}`,
                  }}
                >
                  {sel ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
