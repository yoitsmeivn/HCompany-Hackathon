import type { ID, ComputerStatus, SessionState } from "@/types/common";
import type { Computer } from "@/features/devices/types";
import type { Session } from "@/features/sessions/types";
import type { FileItem } from "@/features/files/types";
import type {
  ActivityEvent,
  ApprovalRequest,
  CandidateFile,
  LiveConnectionStatus,
  LiveFrame,
  Message,
} from "@/features/live-session/types";
import type { DemoFixture } from "@/data/demoFixture";
import type { AppState } from "./initialState";

type Collection = "computers" | "sessions" | "files";

// Event-oriented actions. External integrations (Twilio/Gradium transcripts,
// H Company computer actions, companion/WebRTC connection events, the future
// Express backend) dispatch these same actions via
// src/integrations/runtimeEvents.ts — never by touching components.
export type AppAction =
  | { type: "COMPUTER_CONNECTED"; computer: Computer }
  | { type: "COMPUTER_UPDATED"; computerId: ID; patch: Partial<Computer> }
  | { type: "COMPUTER_DISCONNECTED"; computerId: ID }
  | { type: "SESSION_CREATED"; session: Session }
  | { type: "SESSION_UPDATED"; sessionId: ID; patch: Partial<Session> }
  | { type: "SESSION_MESSAGE_ADDED"; sessionId: ID; message: Message }
  | { type: "SESSION_EVENT_ADDED"; sessionId: ID; event: ActivityEvent }
  | { type: "CANDIDATE_FILE_ADDED"; sessionId: ID; candidate: CandidateFile }
  | { type: "CANDIDATE_SELECTED"; sessionId: ID; candidateId: ID | null }
  | { type: "APPROVAL_REQUESTED"; sessionId: ID; approval: ApprovalRequest }
  | {
      type: "APPROVAL_RESOLVED";
      sessionId: ID;
      approved: boolean;
      deliveryUrl?: string;
    }
  | { type: "LIVE_CONNECTION_CHANGED"; sessionId: ID; status: LiveConnectionStatus }
  | { type: "SESSION_FRAME_UPDATED"; sessionId: ID; frame: LiveFrame }
  | { type: "LIVE_SESSION_INITIALIZED"; sessionId: ID }
  | { type: "FILE_REGISTERED"; file: FileItem }
  | { type: "STATE_IMPORTED"; fixture: DemoFixture }
  | { type: "STATE_RESET" }
  | { type: "PREFERENCES_CHANGED"; patch: Partial<AppState["preferences"]> }
  | { type: "ACTIVE_COMPUTER_CHANGED"; computerId: ID | null }
  // Internal hydration lifecycle
  | { type: "LOAD_STARTED"; collection: Collection }
  | {
      type: "HYDRATED";
      computers: Computer[];
      sessions: Session[];
      files: FileItem[];
      activeComputerId: ID | null;
      preferences: AppState["preferences"];
    }
  | { type: "LOAD_FAILED"; collection: Collection; error: string };

export const computerConnected = (computer: Computer): AppAction => ({
  type: "COMPUTER_CONNECTED",
  computer,
});

export const computerUpdated = (computerId: ID, patch: Partial<Computer>): AppAction => ({
  type: "COMPUTER_UPDATED",
  computerId,
  patch,
});

export const computerDisconnected = (computerId: ID): AppAction => ({
  type: "COMPUTER_DISCONNECTED",
  computerId,
});

export const sessionCreated = (session: Session): AppAction => ({
  type: "SESSION_CREATED",
  session,
});

export const sessionUpdated = (
  sessionId: ID,
  patch: Partial<Session> & { state?: SessionState },
): AppAction => ({ type: "SESSION_UPDATED", sessionId, patch });

export const sessionMessageAdded = (sessionId: ID, message: Message): AppAction => ({
  type: "SESSION_MESSAGE_ADDED",
  sessionId,
  message,
});

export const sessionEventAdded = (sessionId: ID, event: ActivityEvent): AppAction => ({
  type: "SESSION_EVENT_ADDED",
  sessionId,
  event,
});

export const candidateFileAdded = (sessionId: ID, candidate: CandidateFile): AppAction => ({
  type: "CANDIDATE_FILE_ADDED",
  sessionId,
  candidate,
});

export const candidateSelected = (sessionId: ID, candidateId: ID | null): AppAction => ({
  type: "CANDIDATE_SELECTED",
  sessionId,
  candidateId,
});

export const approvalRequested = (sessionId: ID, approval: ApprovalRequest): AppAction => ({
  type: "APPROVAL_REQUESTED",
  sessionId,
  approval,
});

export const approvalResolved = (
  sessionId: ID,
  approved: boolean,
  deliveryUrl?: string,
): AppAction => ({ type: "APPROVAL_RESOLVED", sessionId, approved, deliveryUrl });

export const liveConnectionChanged = (
  sessionId: ID,
  status: LiveConnectionStatus,
): AppAction => ({ type: "LIVE_CONNECTION_CHANGED", sessionId, status });

export const sessionFrameUpdated = (sessionId: ID, frame: LiveFrame): AppAction => ({
  type: "SESSION_FRAME_UPDATED",
  sessionId,
  frame,
});

export const liveSessionInitialized = (sessionId: ID): AppAction => ({
  type: "LIVE_SESSION_INITIALIZED",
  sessionId,
});

export const fileRegistered = (file: FileItem): AppAction => ({
  type: "FILE_REGISTERED",
  file,
});

export const stateImported = (fixture: DemoFixture): AppAction => ({
  type: "STATE_IMPORTED",
  fixture,
});

export const stateReset = (): AppAction => ({ type: "STATE_RESET" });

export const preferencesChanged = (patch: Partial<AppState["preferences"]>): AppAction => ({
  type: "PREFERENCES_CHANGED",
  patch,
});

export const activeComputerChanged = (computerId: ID | null): AppAction => ({
  type: "ACTIVE_COMPUTER_CHANGED",
  computerId,
});

export type { ComputerStatus };
