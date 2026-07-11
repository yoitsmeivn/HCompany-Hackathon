export default function SelectionChips({
  options,
  selected,
  onToggle,
  addLabel,
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
  addLabel: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((name) => {
        const on = selected.includes(name);
        return (
          <button
            key={name}
            className="k-chip"
            onClick={() => onToggle(name)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              borderRadius: 7,
              border: "1px solid",
              padding: "7px 12px",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all .12s",
              fontFamily: "inherit",
              background: on ? "#f5f2ed" : "#fff",
              borderColor: on ? "#d7d2c8" : "#e7e3dd",
              color: on ? "#1c1b19" : "#6a665f",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                height: 14,
                width: 14,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                fontSize: 9,
                background: on ? "#1c1b19" : "#fff",
                color: on ? "#fff" : "transparent",
                border: `1px solid ${on ? "#1c1b19" : "#cfcabf"}`,
              }}
            >
              {on ? "✓" : ""}
            </span>
            {name}
          </button>
        );
      })}
      <button
        className="k-chip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 7,
          border: "1px dashed #cfcabf",
          background: "#fff",
          padding: "7px 12px",
          fontSize: 12.5,
          fontWeight: 500,
          color: "#9a958c",
          cursor: "pointer",
          transition: "all .12s",
          fontFamily: "inherit",
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}
