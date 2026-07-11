export default function KylianLogo({ size = 26 }: { size?: number }) {
  return (
    <span
      style={{
        display: "flex",
        height: size,
        width: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(size * 0.27),
        background: "#1c1b19",
        color: "#fff",
        fontSize: Math.round(size * 0.54),
        fontWeight: 600,
      }}
    >
      K
    </span>
  );
}
