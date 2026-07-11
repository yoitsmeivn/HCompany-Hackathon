import { useRef } from "react";
import { Link } from "react-router-dom";
import { Archive, FileText, FolderOpen, Image, Plus, Sheet } from "lucide-react";
import { usePageTitle } from "@/app/usePageTitle";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DemoDataActions from "@/features/demo/components/DemoDataActions";
import type { FileItem, FileKind } from "@/features/files/types";
import { FILE_ACTION_LABELS, FILE_STATUS_LABELS } from "@/features/files/types";
import { formatRelative } from "@/lib/time";
import { filesFromSelection } from "@/services/filesService";
import { useAppDispatch, useAppState } from "@/store/context";
import { fileRegistered } from "@/store/actions";
import { selectComputerNames } from "@/store/selectors";

const GRID_COLUMNS = "2.4fr 1.1fr 1.1fr 0.9fr 0.8fr 1.2fr";

const HEADER_CELL_STYLE = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#9a958c",
} as const;

function FileIcon({ kind }: { kind: FileKind }) {
  const Icon =
    kind === "image" ? Image : kind === "xlsx" ? Sheet : kind === "other" ? Archive : FileText;
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

  const state = useAppState();
  const dispatch = useAppDispatch();
  const { files, loading, errors } = state;
  const computerNames = selectComputerNames(state);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (selection: FileList | null) => {
    if (!selection) return;
    for (const item of filesFromSelection(selection)) {
      dispatch(fileRegistered(item));
    }
    if (fileInput.current) fileInput.current.value = "";
  };

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
            Files
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6a665f" }}>
            Files Kylian has touched during your sessions.
          </p>
        </div>
        {files.length > 0 && (
          <Button variant="ghost" onClick={() => fileInput.current?.click()}>
            <Plus size={13} strokeWidth={2} /> Add files
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => addFiles(e.target.files)}
      />

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
        {loading.files ? (
          <p style={{ margin: 0, padding: "28px 18px", fontSize: 12.5, color: "#9a958c" }}>
            Loading files…
          </p>
        ) : errors.files ? (
          <p
            style={{
              margin: 0,
              padding: "28px 18px",
              fontSize: 12.5,
              color: "var(--k-danger)",
            }}
          >
            Couldn’t load files: {errors.files}
          </p>
        ) : files.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={17} strokeWidth={1.75} />}
            title="No files yet"
            description="Files Kylian finds, opens, or delivers during a session will appear here. You can also add files from this device."
            action={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Button onClick={() => fileInput.current?.click()}>Add files</Button>
                <DemoDataActions />
              </div>
            }
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
              const computerLabel = file.computerId
                ? (computerNames[file.computerId] ?? "—")
                : file.source === "browser-upload"
                  ? "This device"
                  : "—";

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
                    {computerLabel}
                  </span>
                  <span className="k-col-lastaccessed" style={{ fontSize: 12.5, color: "#6a665f" }}>
                    {formatRelative(file.lastAccessedAt)}
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
