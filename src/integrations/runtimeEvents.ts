import type { Dispatch } from "react";
import type { ID, ComputerStatus, SessionState } from "@/types/common";
import type {
  ActivityEvent,
  ApprovalRequest,
  CandidateFile,
  LiveConnectionStatus,
  Message,
} from "@/features/live-session/types";
import type { FileItem } from "@/features/files/types";
import type { AppAction } from "@/store/actions";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";

// The single adapter between external runtime sources and the app store.
//
// Future sources dispatch through THIS module (never by importing UI
// components):
//   - Twilio / Gradium call + transcript events
//   - OpenAI orchestrator messages
//   - H Company computer-use actions
//   - local companion connection events
//   - WebRTC live-view connection changes
//   - approval and delivered-file events from the Express backend
//
// The in-app DemoControlsPanel dispatches the same events, proving the path.

export type RuntimeEvent =
  | { kind: "companion-status"; computerId: ID; status: ComputerStatus }
  | { kind: "agent-message"; sessionId: ID; text: string; who?: string }
  | { kind: "user-message"; sessionId: ID; text: string; who?: string }
  | { kind: "computer-action"; sessionId: ID; label: string; state?: ActivityEvent["state"] }
  | { kind: "candidate-file"; sessionId: ID; candidate: Omit<CandidateFile, "id"> }
  | { kind: "approval-requested"; sessionId: ID; summary: string; fileName: string }
  | { kind: "approval-resolved"; sessionId: ID; approved: boolean; deliveryUrl?: string }
  | { kind: "live-connection"; sessionId: ID; status: LiveConnectionStatus }
  | { kind: "session-state"; sessionId: ID; state: SessionState; status: string; detail?: string }
  | { kind: "file-delivered"; file: FileItem };

export function applyRuntimeEvent(dispatch: Dispatch<AppAction>, event: RuntimeEvent): void {
  switch (event.kind) {
    case "companion-status":
      dispatch({
        type: "COMPUTER_UPDATED",
        computerId: event.computerId,
        patch: { status: event.status, lastSeenAt: nowIso() },
      });
      return;

    case "agent-message":
    case "user-message": {
      const message: Message = {
        id: newId("msg"),
        who: event.who ?? (event.kind === "agent-message" ? "Kylian" : "You"),
        side: event.kind === "agent-message" ? "agent" : "user",
        text: event.text,
        at: nowIso(),
      };
      dispatch({ type: "SESSION_MESSAGE_ADDED", sessionId: event.sessionId, message });
      return;
    }

    case "computer-action":
      dispatch({
        type: "SESSION_EVENT_ADDED",
        sessionId: event.sessionId,
        event: {
          id: newId("evt"),
          label: event.label,
          at: nowIso(),
          state: event.state ?? "current",
        },
      });
      return;

    case "candidate-file":
      dispatch({
        type: "CANDIDATE_FILE_ADDED",
        sessionId: event.sessionId,
        candidate: { id: newId("cand"), ...event.candidate },
      });
      return;

    case "approval-requested": {
      const approval: ApprovalRequest = {
        id: newId("appr"),
        summary: event.summary,
        fileName: event.fileName,
        status: "pending",
      };
      dispatch({ type: "APPROVAL_REQUESTED", sessionId: event.sessionId, approval });
      return;
    }

    case "approval-resolved":
      dispatch({
        type: "APPROVAL_RESOLVED",
        sessionId: event.sessionId,
        approved: event.approved,
        deliveryUrl: event.deliveryUrl,
      });
      return;

    case "live-connection":
      dispatch({
        type: "LIVE_CONNECTION_CHANGED",
        sessionId: event.sessionId,
        status: event.status,
      });
      return;

    case "session-state":
      dispatch({
        type: "SESSION_UPDATED",
        sessionId: event.sessionId,
        patch: {
          state: event.state,
          status: event.status,
          ...(event.detail !== undefined ? { detail: event.detail } : {}),
        },
      });
      return;

    case "file-delivered":
      dispatch({ type: "FILE_REGISTERED", file: event.file });
      return;
  }
}
