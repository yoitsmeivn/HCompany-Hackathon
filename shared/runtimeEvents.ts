export type RuntimeEvent =
  | { kind: "companion-status"; computerId: string; status: "configured" | "connecting" | "connected" | "offline" }
  | { kind: "agent-message"; sessionId: string; text: string; who?: string; spoken?: boolean }
  | { kind: "agent-speech"; sessionId: string; text: string }
  | { kind: "user-message"; sessionId: string; text: string; who?: string }
  | { kind: "computer-action"; sessionId: string; label: string; state?: "done" | "current" | "pending" }
  | { kind: "candidate-file"; sessionId: string; candidate: { name: string; meta: string; ext: string; evidence?: string } }
  | { kind: "approval-requested"; sessionId: string; summary: string; fileName: string }
  | { kind: "approval-resolved"; sessionId: string; approved: boolean; deliveryUrl?: string }
  | { kind: "live-connection"; sessionId: string; status: "connecting" | "connected" | "disconnected" | "failed" }
  | { kind: "session-state"; sessionId: string; state: "active" | "complete" | "waiting" | "paused" | "failed"; status: string; detail?: string }
  | { kind: "file-delivered"; file: RuntimeFile };

export interface RuntimeFile {
  id: string;
  name: string;
  kind: "pdf" | "pptx" | "docx" | "xlsx" | "image" | "other";
  location: string;
  computerId?: string;
  lastAccessedAt: string;
  action: "opened" | "previewed" | "located" | "delivered" | "uploaded";
  status: "available" | "delivered" | "expired" | "permission-required";
  source: "browser-upload" | "companion" | "demo";
  sessionId?: string;
}

export interface RuntimeEventEnvelope {
  id: string;
  at: string;
  event: RuntimeEvent;
}
