import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Laptop, Monitor, Plus } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AccessSummaryLine from "@/features/access/components/AccessSummaryLine";
import type { Computer } from "@/features/devices/types";
import { listComputers } from "@/services/devices";

export default function ComputersPage() {
  usePageTitle("Computers");

  const [computers, setComputers] = useState<Computer[]>([]);

  useEffect(() => {
    listComputers().then(setComputers);
  }, []);

  return (
    <>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
          Computers
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
          The machines running your Kylian companion.
        </p>
      </div>

      <div
        className="k-computers-grid"
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {computers.map((computer) => {
          const online = computer.status === "online";
          const Icon = computer.model.toLowerCase().includes("macbook") ? Laptop : Monitor;
          return (
            <section
              key={computer.id}
              style={{
                border: "1px solid #e7e3dd",
                borderRadius: 10,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      display: "flex",
                      height: 30,
                      width: 30,
                      flex: "none",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 7,
                      background: "#f5f2ed",
                      border: "1px solid #e7e3dd",
                      color: "#3a382f",
                    }}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}
                  >
                    {computer.name}
                  </span>
                  <Badge dot={online ? "solid" : "hollow"}>{online ? "Online" : "Offline"}</Badge>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#6a665f" }}>
                    {computer.model} · {computer.os}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#6a665f" }}>
                    Last seen · {computer.lastSeen}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    borderTop: "1px solid #f0ece6",
                    paddingTop: 12,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#9a958c",
                    }}
                  >
                    Computer access
                  </p>
                  <AccessSummaryLine access={computer.access} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  borderTop: "1px solid #f0ece6",
                  background: "#faf9f7",
                  padding: "12px 18px",
                }}
              >
                <Button variant="ghost" to="/setup" style={{ flex: 1 }}>
                  Manage access
                </Button>
                <Button variant="control" to="/setup" disabled={!online} style={{ flex: 1 }}>
                  Start session
                </Button>
              </div>
            </section>
          );
        })}

        <Link
          to="/setup"
          className="k-chip"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 220,
            borderRadius: 10,
            border: "1px dashed #cfcabf",
            background: "#fff",
            padding: 24,
            color: "#9a958c",
            textAlign: "center",
            transition: "all .12s",
          }}
        >
          <span
            style={{
              display: "flex",
              height: 30,
              width: 30,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              background: "#f5f2ed",
              border: "1px solid #e7e3dd",
              color: "#6a665f",
            }}
          >
            <Plus size={15} strokeWidth={1.75} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#3a382f" }}>
            Connect a computer
          </span>
          <span style={{ fontSize: 11.5, lineHeight: 1.5, maxWidth: 220 }}>
            Install the Kylian companion and reach this machine from anywhere.
          </span>
        </Link>
      </div>
    </>
  );
}
