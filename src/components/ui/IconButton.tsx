import type { ReactNode } from "react";

export default function IconButton({
  label,
  fontSize = 13,
  children,
}: {
  label: string;
  fontSize?: number;
  children: ReactNode;
}) {
  return (
    <span
      className="k-iconbtn"
      role="button"
      aria-label={label}
      style={{
        display: "flex",
        height: 28,
        width: 28,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        color: "var(--k-faint)",
        fontSize,
        transition: "all .12s",
      }}
    >
      {children}
    </span>
  );
}
