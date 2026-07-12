import type { ID } from "@/types/common";
import type { Computer } from "@/features/devices/types";
import type { Session } from "@/features/sessions/types";
import type { FileItem } from "@/features/files/types";
import type { LiveSessionData } from "@/features/live-session/types";

export interface AppState {
  computers: Computer[];
  sessions: Session[];
  files: FileItem[];
  live: Record<ID, LiveSessionData>;
  activeComputerId: ID | null;
  preferences: { channel: string; name: string; phone: string };
  loading: { computers: boolean; sessions: boolean; files: boolean };
  errors: { computers: string | null; sessions: string | null; files: string | null };
}

export const initialState: AppState = {
  computers: [],
  sessions: [],
  files: [],
  live: {},
  activeComputerId: null,
  preferences: { channel: "Phone", name: "", phone: "" },
  loading: { computers: true, sessions: true, files: true },
  errors: { computers: null, sessions: null, files: null },
};

export function emptyLiveSession(): LiveSessionData {
  return {
    messages: [],
    activity: [],
    candidates: [],
    approval: null,
    feed: null,
    connectionStatus: "connecting",
    isPaused: false,
    isMuted: false,
    selectedCandidateId: null,
  };
}
