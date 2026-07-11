import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      {icon && (
        <span
          style={{
            display: "flex",
            height: 38,
            width: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9,
            border: "1px solid var(--k-border)",
            background: "var(--k-subtle)",
            color: "var(--k-muted)",
            marginBottom: 6,
          }}
        >
          {icon}
        </span>
      )}
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{title}</p>
      {description && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--k-faint)", maxWidth: 340 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
