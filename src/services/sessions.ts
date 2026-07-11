import type { Session } from "@/features/sessions/types";
import type { ID } from "@/types/common";
import { MOCK_SESSIONS } from "@/data/mockSessions";
import { resolve } from "./api";

export function listSessions(): Promise<Session[]> {
  return resolve(MOCK_SESSIONS);
}

export function getSession(id?: ID): Promise<Session> {
  const fallback = MOCK_SESSIONS.find((s) => s.id === "demo-session") ?? MOCK_SESSIONS[0];
  return resolve(MOCK_SESSIONS.find((s) => s.id === id) ?? fallback);
}
