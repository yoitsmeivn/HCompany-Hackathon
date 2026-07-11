import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonVariant = "primary" | "ghost" | "control" | "danger";

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    border: "none",
    borderRadius: 6,
    background: "var(--k-ink)",
    color: "#fff",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    transition: "background .15s",
  },
  ghost: {
    border: "1px solid var(--k-border)",
    borderRadius: 6,
    background: "var(--k-surface)",
    color: "var(--k-muted)",
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 500,
    transition: "all .12s",
  },
  control: {
    border: "1px solid var(--k-border)",
    borderRadius: 7,
    background: "var(--k-surface)",
    color: "var(--k-ink-dim)",
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 500,
    transition: "all .12s",
  },
  danger: {
    border: "none",
    borderRadius: 7,
    background: "var(--k-danger)",
    color: "#fff",
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    transition: "background .12s",
  },
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "k-primary",
  ghost: "k-ghost",
  control: "k-ctrl",
  danger: "k-stop",
};

export default function Button({
  variant = "primary",
  to,
  onClick,
  type = "button",
  disabled,
  style,
  children,
}: {
  variant?: ButtonVariant;
  to?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
    opacity: disabled ? 0.45 : 1,
    pointerEvents: disabled ? "none" : undefined,
    ...VARIANT_STYLES[variant],
    ...style,
  };

  if (to) {
    return (
      <Link to={to} className={VARIANT_CLASSES[variant]} style={base}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={VARIANT_CLASSES[variant]}
      style={base}
    >
      {children}
    </button>
  );
}
