import { Link } from "react-router-dom";
import { User } from "lucide-react";
import StatusDot from "@/components/ui/StatusDot";
import { useAppState } from "@/store/context";
import { selectActiveComputer, selectConnectedComputer } from "@/store/selectors";

export default function DashboardHeader() {
  const state = useAppState();
  const connected = selectConnectedComputer(state);
  const active = selectActiveComputer(state);
  const newSessionTarget = state.computers.length > 0 ? "/new-session" : "/setup";

  const chip = connected
    ? { dot: "solid" as const, label: `${connected.name} · Connected` }
    : active
      ? { dot: "hollow" as const, label: `${active.name} · Not connected` }
      : { dot: "muted" as const, label: "No computer connected" };

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
        <Link
          to={connected ? "/computers" : "/setup"}
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
            color: "inherit",
          }}
        >
          <StatusDot variant={chip.dot} />
          {chip.label}
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          to={newSessionTarget}
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
            color: "#3a382f",
          }}
        >
          <User size={15} strokeWidth={1.75} />
        </span>
      </div>
    </header>
  );
}
