import { useEffect, useRef } from "react";
import type { Message } from "@/features/live-session/types";

export default function ConversationPanel({ messages }: { messages: Message[] }) {
  // Scroll only when a genuinely new message lands (last id changes), never on
  // unrelated re-renders. "nearest" keeps the containing <aside> from jumping
  // when the newest message is already in view.
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLastMessageIdRef = useRef<string | null>(null);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    if (lastMessageId && lastMessageId !== prevLastMessageIdRef.current) {
      bottomRef.current?.scrollIntoView({ block: "nearest" });
    }
    prevLastMessageIdRef.current = lastMessageId;
  }, [lastMessageId]);

  return (
    <section style={{ padding: "18px 18px 16px" }}>
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
        Transcript
      </p>
      {messages.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>No messages yet.</p>
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
      <div ref={bottomRef} aria-hidden />
    </section>
  );
}
