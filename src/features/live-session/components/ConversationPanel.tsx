import type { Message } from "@/features/live-session/types";

export default function ConversationPanel({
  messages,
  draft,
  onDraft,
  onSend,
}: {
  messages: Message[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section style={{ padding: "18px 18px 16px", borderBottom: "1px solid #e7e3dd" }}>
      <p
        style={{
          margin: "0 0 13px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#9a958c",
        }}
      >
        Conversation
      </p>
      {messages.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>
          No messages yet — send Kylian an instruction below.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 11 }}>
          {messages.map((m) => {
            const user = m.side === "user";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  alignItems: user ? "flex-end" : "flex-start",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: "#9a958c" }}>{m.who}</span>
                <span
                  style={{
                    maxWidth: "85%",
                    borderRadius: 9,
                    padding: "9px 12px",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    background: user ? "#1c1b19" : "#fff",
                    color: user ? "#fff" : "#3a382f",
                    border: `1px solid ${user ? "#1c1b19" : "#e7e3dd"}`,
                  }}
                >
                  {m.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        style={{ marginTop: 13, display: "flex", gap: 8 }}
      >
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder="Add an instruction…"
          style={{
            flex: 1,
            border: "1px solid #e7e3dd",
            borderRadius: 7,
            background: "#fff",
            padding: "9px 11px",
            fontSize: 12.5,
            transition: "border-color .12s,box-shadow .12s",
          }}
        />
        <button
          type="submit"
          className="k-primary"
          style={{
            border: "none",
            borderRadius: 7,
            background: "#1c1b19",
            color: "#fff",
            padding: "0 14px",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background .15s",
          }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
