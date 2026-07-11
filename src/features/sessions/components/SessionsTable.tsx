import { Link } from "react-router-dom";
import type { Session } from "@/features/sessions/types";
import { ACCESS_MODE_LABELS } from "@/features/access/types";
import { formatRelative } from "@/lib/time";
import Badge from "@/components/ui/Badge";
import IconButton from "@/components/ui/IconButton";

const GRID_COLUMNS = "2.9fr 0.9fr 1.1fr 1fr 0.9fr 78px";

const HEADER_CELL_STYLE = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#9a958c",
} as const;

function Thumbnail() {
  return (
    <span
      style={{
        flex: "none",
        height: 38,
        width: 52,
        borderRadius: 6,
        border: "1px solid #e7e3dd",
        background: "#f2efe9",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 5,
          top: 5,
          right: 5,
          height: 7,
          borderRadius: "2px 2px 0 0",
          background: "#d9d4c9",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 5,
          top: 14,
          right: 5,
          bottom: 5,
          borderRadius: "0 0 2px 2px",
          background: "#fff",
          border: "1px solid #e7e3dd",
          borderTop: "none",
        }}
      />
    </span>
  );
}

export default function SessionsTable({
  sessions,
  computerNames,
}: {
  sessions: Session[];
  computerNames: Record<string, string>;
}) {
  return (
    <div
      style={{
        marginTop: 22,
        border: "1px solid #e7e3dd",
        borderRadius: 9,
        background: "#fff",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLUMNS,
          gap: 12,
          alignItems: "center",
          padding: "11px 18px",
          borderBottom: "1px solid #e7e3dd",
          background: "#f7f5f0",
        }}
      >
        <span style={HEADER_CELL_STYLE}>Name</span>
        <span className="k-col-lastactive" style={HEADER_CELL_STYLE}>
          Last active
        </span>
        <span className="k-col-device" style={HEADER_CELL_STYLE}>
          Device
        </span>
        <span style={HEADER_CELL_STYLE}>Status</span>
        <span className="k-col-access" style={HEADER_CELL_STYLE}>
          Access
        </span>
        <span />
      </div>

      {sessions.map((session) => {
        const solid = session.state === "active" || session.state === "complete";
        return (
          <Link
            key={session.id}
            to={`/session/${session.id}`}
            className="k-row"
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: 12,
              alignItems: "center",
              padding: "13px 18px",
              borderBottom: "1px solid #f0ece6",
              transition: "background .12s",
              color: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Thumbnail />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: "#1c1b19",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {session.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "#9a958c",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {session.detail}
                </span>
              </span>
            </span>
            <span className="k-col-lastactive" style={{ fontSize: 12.5, color: "#6a665f" }}>
              {session.state === "active" ? "Active now" : formatRelative(session.lastActiveAt)}
            </span>
            <span
              className="k-col-device"
              style={{
                fontSize: 12.5,
                color: "#6a665f",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {computerNames[session.computerId] ?? "—"}
            </span>
            <span>
              <Badge dot={solid ? "solid" : "hollow"}>{session.status}</Badge>
            </span>
            <span className="k-col-access" style={{ fontSize: 12.5, color: "#6a665f" }}>
              {ACCESS_MODE_LABELS[session.accessMode]}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
              }}
            >
              <IconButton label="Open session">↗</IconButton>
              <IconButton label="More options" fontSize={15}>
                ⋯
              </IconButton>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
