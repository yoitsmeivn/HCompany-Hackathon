import { Link, useLocation } from "react-router-dom";
import KylianWordmark from "@/components/brand/KylianWordmark";

export default function MarketingHeader() {
  const { pathname } = useLocation();
  const isSetup = pathname.startsWith("/setup");

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid #e7e3dd",
        background: isSetup ? "rgba(250,249,247,0.9)" : "rgba(250,249,247,0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: isSetup ? 960 : 1120,
          margin: "0 auto",
          height: isSetup ? 60 : 64,
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <KylianWordmark />
        {isSetup ? (
          <Link to="/dashboard" style={{ fontSize: 13, fontWeight: 450, color: "#6a665f" }}>
            Skip to dashboard →
          </Link>
        ) : (
          <>
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#6a665f",
              }}
            >
              <a href="#product" style={{ color: "inherit" }}>
                Product
              </a>
              <a href="#security" style={{ color: "inherit" }}>
                Security
              </a>
              <a href="#how" style={{ color: "inherit" }}>
                How it works
              </a>
            </nav>
            <Link
              to="/dashboard"
              style={{
                borderRadius: 6,
                background: "#1c1b19",
                color: "#fff",
                padding: "8px 15px",
                fontSize: 13,
                fontWeight: 500,
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              Open Kylian
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
