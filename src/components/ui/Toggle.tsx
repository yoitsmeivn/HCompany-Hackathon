export default function Toggle({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      style={{
        position: "relative",
        height: 24,
        width: 42,
        border: "none",
        borderRadius: 999,
        cursor: disabled ? "default" : "pointer",
        transition: "background .15s",
        background: on ? "#1c1b19" : "#d7d2c8",
        flex: "none",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          height: 20,
          width: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          transition: "left .15s",
          left: on ? 20 : 2,
        }}
      />
    </button>
  );
}
