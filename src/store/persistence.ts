import type { ID } from "@/types/common";
import type { Computer } from "@/features/devices/types";
import type { Session } from "@/features/sessions/types";
import type { FileItem } from "@/features/files/types";
import type { AppState } from "./initialState";

// The ONLY module in the app that touches localStorage.
//
// Persisted: computers, session metadata, file metadata, access/channel
// preferences, active computer id.
// NEVER persisted: live session data (conversation transcripts, feed/screen
// info, delivery URLs, approval details), connection state, loading/error
// flags, raw File objects (only metadata ever enters the store).

const STORAGE_KEY = "kylian-state-v1";
const VERSION = 1;

export interface PersistedState {
  version: number;
  computers: Computer[];
  sessions: Session[];
  files: FileItem[];
  activeComputerId: ID | null;
  preferences: { channel: string; name: string; phone: string };
}

function project(state: AppState): PersistedState {
  return {
    version: VERSION,
    computers: state.computers,
    sessions: state.sessions,
    files: state.files,
    activeComputerId: state.activeComputerId,
    preferences: state.preferences,
  };
}

export function load(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== VERSION) return null;
    return {
      ...parsed,
      // Live connection state is not trusted across reloads: a computer is
      // only "connected" while the companion is actually talking to us.
      computers: (parsed.computers ?? []).map((c) =>
        c.status === "connected" || c.status === "connecting"
          ? { ...c, status: "configured" as const }
          : c,
      ),
      sessions: parsed.sessions ?? [],
      files: parsed.files ?? [],
      preferences: Object.assign({ channel: "Phone", name: "", phone: "" }, parsed.preferences),
      activeComputerId: parsed.activeComputerId ?? null,
    };
  } catch {
    return null;
  }
}

export function save(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project(state)));
  } catch {
    // Storage may be unavailable (private mode, quota) — the app keeps
    // working from memory.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
