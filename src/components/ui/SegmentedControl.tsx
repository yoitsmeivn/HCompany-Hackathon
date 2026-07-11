export default function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--k-border)",
        borderRadius: 8,
        background: "var(--k-bg)",
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((name) => {
        const on = value === name;
        return (
          <button
            key={name}
            onClick={() => onChange(name)}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "6px 13px",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all .12s",
              fontFamily: "inherit",
              background: on ? "#fff" : "transparent",
              color: on ? "var(--k-ink)" : "var(--k-muted)",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
