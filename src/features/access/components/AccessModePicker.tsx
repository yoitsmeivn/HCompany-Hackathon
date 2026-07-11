import type { AccessMode } from "@/features/access/types";
import { ACCESS_MODE_DESCRIPTIONS, ACCESS_MODE_LABELS } from "@/features/access/types";

const MODES: AccessMode[] = ["ask", "selected", "full"];

export default function AccessModePicker({
  value,
  onChange,
}: {
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {MODES.map((mode) => {
        const on = value === mode;
        return (
          <button
            key={mode}
            className="k-chip"
            onClick={() => onChange(mode)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              textAlign: "left",
              borderRadius: 8,
              border: "1px solid",
              padding: "11px 13px",
              cursor: "pointer",
              transition: "all .12s",
              fontFamily: "inherit",
              background: on ? "#f5f2ed" : "#fff",
              borderColor: on ? "#d7d2c8" : "#e7e3dd",
            }}
          >
            <span
              style={{
                marginTop: 2,
                display: "inline-flex",
                height: 14,
                width: 14,
                flex: "none",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: 8,
                background: on ? "#1c1b19" : "#fff",
                color: on ? "#fff" : "transparent",
                border: `1px solid ${on ? "#1c1b19" : "#cfcabf"}`,
              }}
            >
              {on ? "✓" : ""}
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: on ? "#1c1b19" : "#3a382f",
                }}
              >
                {ACCESS_MODE_LABELS[mode]}
                {mode === "ask" && (
                  <span
                    style={{
                      borderRadius: 4,
                      border: "1px solid #d7d2c8",
                      background: on ? "#fff" : "#f5f2ed",
                      padding: "1px 6px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color: "#6a665f",
                    }}
                  >
                    Recommended
                  </span>
                )}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: "#9a958c",
                }}
              >
                {ACCESS_MODE_DESCRIPTIONS[mode]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
