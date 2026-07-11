import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Laptop, Monitor } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import Badge from "@/components/ui/Badge";
import AccessSummaryLine from "@/features/access/components/AccessSummaryLine";
import { COMPUTER_STATUS_LABELS } from "@/features/devices/types";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { useAppDispatch, useAppState } from "@/store/context";
import { liveSessionInitialized, sessionCreated } from "@/store/actions";
import { selectActiveComputer } from "@/store/selectors";

export default function NewSessionPage() {
  usePageTitle("New session");

  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const computer = selectActiveComputer(state);
  const [task, setTask] = useState("");

  if (!state.loading.computers && !computer) {
    return <Navigate to="/setup" replace />;
  }
  if (!computer) return null;

  const Icon = computer.model?.toLowerCase().includes("macbook") ? Laptop : Monitor;
  const canStart = task.trim().length > 0;

  const startSession = () => {
    const text = task.trim();
    if (!text) return;
    const id = newId("session");
    dispatch(
      sessionCreated({
        id,
        name: text.split("\n")[0].slice(0, 80),
        detail: "Waiting for Kylian to start",
        lastActiveAt: nowIso(),
        computerId: computer.id,
        status: "Waiting",
        state: "waiting",
        accessMode: computer.access.mode,
      }),
    );
    dispatch(liveSessionInitialized(id));
    navigate(`/session/${id}`);
  };

  return (
    <>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
          New session
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
          Tell Kylian what you need from your computer.
        </p>
      </div>

      <section
        style={{
          marginTop: 22,
          maxWidth: 640,
          border: "1px solid #e7e3dd",
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 22, display: "grid", gap: 20 }}>
          {/* Computer */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
              Computer
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid #e7e3dd",
                borderRadius: 8,
                background: "#faf9f7",
                padding: "12px 14px",
              }}
            >
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
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0 }}>
                {computer.name}
              </span>
              <Badge dot={computer.status === "connected" ? "solid" : "hollow"}>
                {COMPUTER_STATUS_LABELS[computer.status]}
              </Badge>
            </div>
          </div>

          {/* Task */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
              What should Kylian do?
            </label>
            <textarea
              className="k-input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Find the latest version of my presentation and send it to me"
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                border: "1px solid #e7e3dd",
                borderRadius: 7,
                background: "#fff",
                padding: "10px 12px",
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "#1c1b19",
                fontFamily: "inherit",
                transition: "border-color .12s, box-shadow .12s",
              }}
            />
          </div>

          {/* Summaries */}
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                border: "1px solid #e7e3dd",
                borderRadius: 8,
                background: "#faf9f7",
                padding: "12px 14px",
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
            <div
              style={{
                border: "1px solid #e7e3dd",
                borderRadius: 8,
                background: "#faf9f7",
                padding: "12px 14px",
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
                Communication
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#6a665f" }}>
                Kylian will reach you via {state.preferences.channel}.
              </p>
            </div>
          </div>

          <button
            className="k-primary"
            onClick={startSession}
            disabled={!canStart}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 8,
              background: "#1c1b19",
              color: "#fff",
              padding: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: canStart ? "pointer" : "default",
              opacity: canStart ? 1 : 0.45,
              transition: "background .15s",
              fontFamily: "inherit",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            Start session
          </button>
        </div>
      </section>
    </>
  );
}
