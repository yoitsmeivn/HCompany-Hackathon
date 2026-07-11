import type { ID } from "@/types/common";
import type { LiveSessionData } from "@/features/live-session/types";
import { emptyLiveSession } from "@/store/initialState";
import { resolve } from "./api";

// Live session data (transcripts, activity, approvals, connection state) is
// intentionally never persisted locally. Today a session starts empty; the
// future backend/WebSocket boundary streams real events into the store via
// src/integrations/runtimeEvents.ts.
export function load(sessionId: ID): Promise<LiveSessionData> {
  void sessionId; // will select the session on the backend
  return resolve(emptyLiveSession());
}
