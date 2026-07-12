import { Link } from "react-router-dom";
import KylianLogo from "@/components/brand/KylianLogo";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #e7e3dd", background: "#faf9f7" }}>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "32px 28px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KylianLogo size={22} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Kylian</span>
        </Link>
        <p style={{ margin: 0, fontSize: 12.5, color: "#9a958c" }}>
          A secure remote computer assistant. © 2026 Kylian.
        </p>
      </div>
    </footer>
  );
}
