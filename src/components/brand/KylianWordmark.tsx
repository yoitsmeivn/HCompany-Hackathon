import { Link } from "react-router-dom";
import KylianLogo from "./KylianLogo";

export default function KylianWordmark({
  size = 26,
  gap = 10,
  fontSize = 15,
}: {
  size?: number;
  gap?: number;
  fontSize?: number;
}) {
  return (
    <Link to="/" style={{ display: "flex", alignItems: "center", gap }}>
      <KylianLogo size={size} />
      <span style={{ fontSize, fontWeight: 600, letterSpacing: "-0.01em" }}>Kylian</span>
    </Link>
  );
}
