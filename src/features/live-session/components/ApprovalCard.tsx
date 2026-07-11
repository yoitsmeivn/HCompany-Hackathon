import type { ApprovalRequest } from "@/features/live-session/types";

export default function ApprovalCard({
  approval,
  onResolve,
}: {
  approval: ApprovalRequest | null;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <section style={{ padding: "18px 18px 24px" }}>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#9a958c",
        }}
      >
        Approval request
      </p>

      {!approval ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>
          Nothing is waiting for your approval right now.
        </p>
      ) : approval.status === "pending" ? (
        <div
          style={{
            border: "1px solid #d7d2c8",
            borderRadius: 10,
            background: "#fff",
            padding: 15,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              className="k-pulse"
              style={{ height: 7, width: 7, borderRadius: "50%", background: "#1c1b19" }}
            />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Waiting for your approval</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#3a382f" }}>
            {approval.summary}{" "}
            <span style={{ fontWeight: 600 }}>{approval.fileName}</span>
          </p>
          <div style={{ marginTop: 13, display: "flex", gap: 8 }}>
            <button
              onClick={() => onResolve(true)}
              className="k-primary"
              style={{
                flex: 1,
                border: "none",
                borderRadius: 7,
                background: "#1c1b19",
                color: "#fff",
                padding: 10,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background .15s",
              }}
            >
              Approve &amp; send
            </button>
            <button
              onClick={() => onResolve(false)}
              className="k-ghost"
              style={{
                border: "1px solid #e7e3dd",
                borderRadius: 7,
                background: "#fff",
                padding: "10px 16px",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#6a665f",
                cursor: "pointer",
                transition: "all .12s",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : approval.status === "approved" ? (
        <div
          style={{
            border: "1px solid #d7d2c8",
            borderRadius: 10,
            background: "#fff",
            padding: 15,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                height: 16,
                width: 16,
                borderRadius: "50%",
                background: "#1c1b19",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Approved</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#3a382f" }}>
            <span style={{ fontWeight: 600 }}>{approval.fileName}</span> will be delivered through
            a secure temporary link.
          </p>
          {approval.deliveryUrl && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 9,
                border: "1px solid #e7e3dd",
                borderRadius: 7,
                background: "#faf9f7",
                padding: "9px 11px",
              }}
            >
              <span style={{ fontSize: 13 }}>🔗</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 11.5,
                  color: "#6a665f",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {approval.deliveryUrl}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>
          You declined this request. Nothing was sent.
        </p>
      )}
    </section>
  );
}
