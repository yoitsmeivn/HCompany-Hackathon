import { Link } from "react-router-dom";
import StatusDot from "@/components/ui/StatusDot";
import { MOCK_COMPUTERS } from "@/data/mockComputers";

export default function DashboardHeader() {
  const primary = MOCK_COMPUTERS.find((c) => c.status === "online") ?? MOCK_COMPUTERS[0];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        borderBottom: "1px solid #e7e3dd",
        background: "rgba(250,249,247,0.9)",
        backdropFilter: "blur(8px)",
        padding: "0 28px",
        height: 60,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            borderRadius: 6,
            border: "1px solid #e7e3dd",
            background: "#fff",
            padding: "5px 10px",
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <StatusDot variant={primary.status === "online" ? "solid" : "hollow"} />
          {primary.name} · {primary.status === "online" ? "Connected" : "Offline"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          to="/setup"
          style={{
            borderRadius: 6,
            background: "#1c1b19",
            color: "#fff",
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          New session
        </Link>
        <span
          style={{
            display: "flex",
            height: 32,
            width: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "#e7e3dd",
            fontSize: 12,
            fontWeight: 600,
            color: "#3a382f",
          }}
        >
          IV
        </span>
      </div>
    </header>
  );
}
