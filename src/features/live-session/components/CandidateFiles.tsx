import type { ID } from "@/types/common";
import type { CandidateFile } from "@/features/live-session/types";

const ICON_COLORS = ["#c96f5e", "#5e7bc9", "#8a8378", "#7a9a6d"];

export default function CandidateFiles({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: CandidateFile[];
  selectedId: ID | null;
  onSelect: (id: ID | null) => void;
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
        {candidates.length > 0 && (
          <span style={{ fontSize: 11, color: "#9a958c" }}>{candidates.length} found</span>
        )}
      </div>
      {candidates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>
          When Kylian finds matching files, they’ll be listed here for you to choose from.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {candidates.map((candidate, i) => {
            const sel = selectedId === candidate.id;
            return (
              <div
                key={candidate.id}
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
                      background: ICON_COLORS[i % ICON_COLORS.length],
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 3,
                      fontSize: 7,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {candidate.ext}
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
                      {candidate.name}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9a958c" }}>
                      {candidate.meta}
                    </p>
                  </div>
                </div>
                {candidate.evidence && (
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
                    {candidate.evidence}
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
                    onClick={() => onSelect(sel ? null : candidate.id)}
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
      )}
    </section>
  );
}
