import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import KylianLogo from "@/components/brand/KylianLogo";

export default function NotFoundPage() {
  usePageTitle("Page not found");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 28,
        textAlign: "center",
      }}
    >
      <KylianLogo size={34} />
      <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
        This screen isn’t connected.
      </h1>
      <p style={{ margin: 0, fontSize: 13.5, color: "#6a665f", maxWidth: 380, lineHeight: 1.6 }}>
        The page you’re looking for doesn’t exist. Kylian may have moved it, or the link has
        expired.
      </p>
      <Link
        to="/"
        className="k-primary"
        style={{
          marginTop: 10,
          borderRadius: 6,
          background: "#1c1b19",
          color: "#fff",
          padding: "10px 18px",
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          transition: "background .15s",
        }}
      >
        Back to Kylian
      </Link>
    </main>
  );
}
