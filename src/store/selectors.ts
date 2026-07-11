import type { ID } from "@/types/common";
import type { Computer } from "@/features/devices/types";
import type { Session } from "@/features/sessions/types";
import type { LiveSessionData } from "@/features/live-session/types";
import type { AppState } from "./initialState";

export function selectActiveComputer(state: AppState): Computer | undefined {
  return (
    state.computers.find((c) => c.id === state.activeComputerId) ?? state.computers[0]
  );
}

export function selectConnectedComputer(state: AppState): Computer | undefined {
  return state.computers.find((c) => c.status === "connected");
}

export function selectComputerNames(state: AppState): Record<ID, string> {
  return Object.fromEntries(state.computers.map((c) => [c.id, c.name]));
}

export function selectSessionById(state: AppState, id?: ID): Session | undefined {
  if (!id) return undefined;
  return state.sessions.find((s) => s.id === id);
}

export function selectMostRecentActiveSession(state: AppState): Session | undefined {
  return state.sessions
    .filter((s) => s.state === "active" || s.state === "waiting")
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))[0];
}

export function selectRecentSessions(state: AppState, count: number): Session[] {
  return [...state.sessions]
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))
    .slice(0, count);
}

export function selectLive(state: AppState, sessionId: ID): LiveSessionData | undefined {
  return state.live[sessionId];
}

export function selectCounts(state: AppState): { active: number; waiting: number } {
  return {
    active: state.sessions.filter((s) => s.state === "active").length,
    waiting: state.sessions.filter((s) => s.state === "waiting").length,
  };
}

export function hasAnyData(state: AppState): boolean {
  return state.computers.length > 0 || state.sessions.length > 0 || state.files.length > 0;
}
