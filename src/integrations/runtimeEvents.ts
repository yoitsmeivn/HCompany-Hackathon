import type { Dispatch } from "react";
import type { RuntimeEventEnvelope } from "../../shared/runtimeEvents";
import type {
  ApprovalRequest,
  Message,
} from "@/features/live-session/types";
import type { AppAction } from "@/store/actions";

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

export type { RuntimeEvent, RuntimeEventEnvelope } from "../../shared/runtimeEvents";

// Ids are derived from the envelope id (minted once on the server), so a
// replayed or re-delivered envelope maps to the same entity instead of a new one.
export function applyRuntimeEvent(dispatch: Dispatch<AppAction>, envelope: RuntimeEventEnvelope): void {
  const { event, id, at } = envelope;
  switch (event.kind) {
    case "companion-status":
      dispatch({
        type: "COMPUTER_UPDATED",
        computerId: event.computerId,
        patch: { status: event.status, lastSeenAt: at },
      });
      return;

    case "agent-message":
    case "user-message": {
      const message: Message = {
        id: `msg-${id}`,
        who: event.who ?? (event.kind === "agent-message" ? "Kylian" : "You"),
        side: event.kind === "agent-message" ? "agent" : "user",
        text: event.text,
        at,
      };
      dispatch({ type: "SESSION_MESSAGE_ADDED", sessionId: event.sessionId, message });
      return;
    }

    case "computer-action":
      dispatch({
        type: "SESSION_EVENT_ADDED",
        sessionId: event.sessionId,
        event: {
          id: `evt-${id}`,
          label: event.label,
          at,
          state: event.state ?? "current",
        },
      });
      return;

    case "candidate-file":
      dispatch({
        type: "CANDIDATE_FILE_ADDED",
        sessionId: event.sessionId,
        candidate: { id: `cand-${id}`, ...event.candidate },
      });
      return;

    case "approval-requested": {
      const approval: ApprovalRequest = {
        id: `appr-${id}`,
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
