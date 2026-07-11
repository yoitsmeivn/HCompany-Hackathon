import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FolderOpen, Image, Sheet } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { FileItem, FileKind } from "@/features/files/types";
import { FILE_ACTION_LABELS, FILE_STATUS_LABELS } from "@/features/files/types";
import type { Computer } from "@/features/devices/types";
import { listFiles } from "@/services/files";
import { listComputers } from "@/services/devices";

const GRID_COLUMNS = "2.4fr 1.1fr 1.1fr 0.9fr 0.8fr 1.2fr";

const HEADER_CELL_STYLE = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#9a958c",
} as const;

function FileIcon({ kind }: { kind: FileKind }) {
  const Icon = kind === "image" ? Image : kind === "xlsx" ? Sheet : FileText;
  return (
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
        color: "#6a665f",
      }}
    >
      <Icon size={14} strokeWidth={1.75} />
    </span>
  );
}

function statusDot(status: FileItem["status"]): "solid" | "hollow" | "muted" {
  if (status === "available" || status === "delivered") return "solid";
  if (status === "expired") return "muted";
  return "hollow";
}

export default function FilesPage() {
  usePageTitle("Files");

  const [files, setFiles] = useState<FileItem[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listFiles().then((f) => {
      setFiles(f);
      setLoaded(true);
    });
    listComputers().then(setComputers);
  }, []);

  const computerNames = Object.fromEntries(computers.map((c) => [c.id, c.name]));

  return (
    <>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
          Files
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
          Files Kylian has touched during your sessions.
        </p>
      </div>

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
        {loaded && files.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={17} strokeWidth={1.75} />}
            title="No files yet"
            description="Files Kylian finds, opens, or delivers during a session will appear here."
          />
        ) : (
          <>
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
              <span style={HEADER_CELL_STYLE}>File</span>
              <span className="k-col-location" style={HEADER_CELL_STYLE}>
                Location
              </span>
              <span className="k-col-computer" style={HEADER_CELL_STYLE}>
                Computer
              </span>
              <span className="k-col-lastaccessed" style={HEADER_CELL_STYLE}>
                Last accessed
              </span>
              <span style={HEADER_CELL_STYLE}>Action</span>
              <span style={HEADER_CELL_STYLE}>Status</span>
            </div>

            {files.map((file) => {
              const row = (
                <>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <FileIcon kind={file.kind} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1c1b19",
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {file.name}
                    </span>
                  </span>
                  <span
                    className="k-col-location"
                    style={{
                      fontSize: 12.5,
                      color: "#6a665f",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {file.location}
                  </span>
                  <span
                    className="k-col-computer"
                    style={{
                      fontSize: 12.5,
                      color: "#6a665f",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {computerNames[file.computerId] ?? file.computerId}
                  </span>
                  <span className="k-col-lastaccessed" style={{ fontSize: 12.5, color: "#6a665f" }}>
                    {file.lastAccessed}
                  </span>
                  <span style={{ fontSize: 12.5, color: "#6a665f" }}>
                    {FILE_ACTION_LABELS[file.action]}
                  </span>
                  <span>
                    <Badge dot={statusDot(file.status)}>{FILE_STATUS_LABELS[file.status]}</Badge>
                  </span>
                </>
              );

              const rowStyle = {
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                gap: 12,
                alignItems: "center",
                padding: "13px 18px",
                borderBottom: "1px solid #f0ece6",
                transition: "background .12s",
                color: "inherit",
              } as const;

              return file.sessionId ? (
                <Link
                  key={file.id}
                  to={`/session/${file.sessionId}`}
                  className="k-row"
                  style={rowStyle}
                >
                  {row}
                </Link>
              ) : (
                <div key={file.id} style={rowStyle}>
                  {row}
                </div>
              );
            })}
          </>
        )}
      </div>

      <p style={{ margin: "16px 2px 0", fontSize: 12, color: "#9a958c" }}>
        Kylian never stores file contents · Delivery links expire after 7 days.
      </p>
    </>
  );
}
