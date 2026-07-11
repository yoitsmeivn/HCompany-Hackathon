type StatusDotVariant = "solid" | "hollow" | "pulse" | "muted";

export default function StatusDot({
  variant = "solid",
  size = 7,
}: {
  variant?: StatusDotVariant;
  size?: number;
}) {
  if (variant === "hollow") {
    return (
      <span
        style={{
          height: size,
          width: size,
          borderRadius: "50%",
          border: "1.5px solid var(--k-dot-muted)",
          boxSizing: "border-box",
          flex: "none",
        }}
      />
    );
  }
  return (
    <span
      className={variant === "pulse" ? "k-pulse" : undefined}
      style={{
        height: size,
        width: size,
        borderRadius: "50%",
        background: variant === "muted" ? "var(--k-dot-muted)" : "var(--k-ink)",
        flex: "none",
      }}
    />
  );
}
