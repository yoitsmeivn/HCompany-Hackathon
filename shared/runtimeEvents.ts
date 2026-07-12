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
  // One desktop screenshot observed during a computer-use step. Opt-in only
  // (KYLIAN_LIVE_VIEW): the executor never emits this unless the operator asked
  // for live view. `seq` is monotonic per run so the client can drop stale frames.
  | { kind: "screen-frame"; sessionId: string; mediaType: string; dataBase64: string; seq: number }
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

// Monitor events are broadcast globally (not keyed by session) so an idle
// "monitoring" client can discover a call the moment it lands, without knowing
// the Twilio-minted CallSid in advance.
export type MonitorEvent =
  | { kind: "call-started"; sessionId: string; computerId: string; from?: string }
  | { kind: "call-ended"; sessionId: string };

export interface MonitorEventEnvelope {
  id: string;
  at: string;
  event: MonitorEvent;
}
