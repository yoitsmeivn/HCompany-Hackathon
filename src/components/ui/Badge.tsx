import type { ReactNode } from "react";
import StatusDot from "./StatusDot";

export default function Badge({
  children,
  dot,
}: {
  children: ReactNode;
  dot?: "solid" | "hollow" | "pulse" | "muted";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 5,
        border: "1px solid var(--k-border)",
        background: "var(--k-bg)",
        padding: "3px 8px",
        fontSize: 11.5,
        fontWeight: 500,
        color: "var(--k-ink-dim)",
        whiteSpace: "nowrap",
      }}
    >
      {dot && <StatusDot variant={dot} size={6} />}
      {children}
    </span>
  );
}
