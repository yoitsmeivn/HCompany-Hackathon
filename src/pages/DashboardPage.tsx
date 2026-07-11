import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/usePageTitle";
import SessionsTable from "@/features/sessions/components/SessionsTable";
import type { Session } from "@/features/sessions/types";
import type { Computer } from "@/features/devices/types";
import { listSessions } from "@/services/sessions";
import { listComputers } from "@/services/devices";

export default function DashboardPage() {
  usePageTitle("Sessions");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);

  useEffect(() => {
    listSessions().then(setSessions);
    listComputers().then(setComputers);
  }, []);

  const computerNames = Object.fromEntries(computers.map((c) => [c.id, c.name]));
  const activeCount = sessions.filter((s) => s.state === "active").length;
  const waitingCount = sessions.filter((s) => s.state === "waiting").length;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
            Recent sessions
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
            Tasks Kylian has run on your computer.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sessions.length > 0 && (
            <span style={{ fontSize: 12.5, color: "#9a958c", marginRight: 4 }}>
              {activeCount} active · {waitingCount} waiting on you
            </span>
          )}
          {["All computers", "Any status"].map((label) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 6,
                border: "1px solid #e7e3dd",
                background: "#fff",
                padding: "6px 11px",
                fontSize: 12.5,
                fontWeight: 450,
                color: "#6a665f",
              }}
            >
              {label} <span style={{ opacity: 0.5 }}>▾</span>
            </span>
          ))}
        </div>
      </div>
      <SessionsTable sessions={sessions} computerNames={computerNames} />
    </>
  );
}
