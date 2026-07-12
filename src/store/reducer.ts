import type { ID } from "@/types/common";
import type { LiveSessionData } from "@/features/live-session/types";
import { nowIso } from "@/lib/time";
import type { AppAction } from "./actions";
import type { AppState } from "./initialState";
import { emptyLiveSession, initialState } from "./initialState";

function updateLive(
  state: AppState,
  sessionId: ID,
  update: (live: LiveSessionData) => LiveSessionData,
  touchSession = false,
): AppState {
  const current = state.live[sessionId] ?? emptyLiveSession();
  return {
    ...state,
    live: { ...state.live, [sessionId]: update(current) },
    sessions: touchSession
      ? state.sessions.map((s) => (s.id === sessionId ? { ...s, lastActiveAt: nowIso() } : s))
      : state.sessions,
  };
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_STARTED":
      return {
        ...state,
        loading: { ...state.loading, [action.collection]: true },
        errors: { ...state.errors, [action.collection]: null },
      };

    case "HYDRATED":
      return {
        ...state,
        computers: action.computers,
        sessions: action.sessions,
        files: action.files,
        activeComputerId: action.activeComputerId,
        preferences: action.preferences,
        loading: { computers: false, sessions: false, files: false },
        errors: { computers: null, sessions: null, files: null },
      };

    case "LOAD_FAILED":
      return {
        ...state,
        loading: { ...state.loading, [action.collection]: false },
        errors: { ...state.errors, [action.collection]: action.error },
      };

    case "COMPUTER_CONNECTED": {
      const exists = state.computers.some((c) => c.id === action.computer.id);
      return {
        ...state,
        computers: exists
          ? state.computers.map((c) => (c.id === action.computer.id ? action.computer : c))
          : [...state.computers, action.computer],
        activeComputerId: state.activeComputerId ?? action.computer.id,
      };
    }

    case "COMPUTER_UPDATED":
      return {
        ...state,
        computers: state.computers.map((c) =>
          c.id === action.computerId ? { ...c, ...action.patch } : c,
        ),
      };

    case "COMPUTER_DISCONNECTED":
      return {
        ...state,
        computers: state.computers.map((c) =>
          c.id === action.computerId ? { ...c, status: "offline", lastSeenAt: nowIso() } : c,
        ),
      };

    case "SESSION_CREATED":
      return { ...state, sessions: [action.session, ...state.sessions] };

    case "SESSION_UPDATED":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, ...action.patch, lastActiveAt: nowIso() } : s,
        ),
      };

    case "SESSION_MESSAGE_ADDED":
      // Idempotent: replayed/re-delivered events reuse their envelope-derived id.
      if (state.live[action.sessionId]?.messages.some((m) => m.id === action.message.id)) {
        return state;
      }
      return updateLive(
        state,
        action.sessionId,
        (live) => ({ ...live, messages: [...live.messages, action.message] }),
        true,
      );

    case "SESSION_EVENT_ADDED":
      if (state.live[action.sessionId]?.activity.some((e) => e.id === action.event.id)) {
        return state;
      }
      return updateLive(
        state,
        action.sessionId,
        (live) => ({
          ...live,
          activity: [
            // A new event supersedes the previous "current" step.
            ...live.activity.map((e) => (e.state === "current" ? { ...e, state: "done" as const } : e)),
            action.event,
          ],
        }),
        true,
      );

    case "CANDIDATE_FILE_ADDED":
      if (state.live[action.sessionId]?.candidates.some((c) => c.id === action.candidate.id)) {
        return state;
      }
      return updateLive(
        state,
        action.sessionId,
        (live) => ({ ...live, candidates: [...live.candidates, action.candidate] }),
        true,
      );

    case "CANDIDATE_SELECTED":
      return updateLive(state, action.sessionId, (live) => ({
        ...live,
        selectedCandidateId: action.candidateId,
      }));

    case "APPROVAL_REQUESTED":
      // A replayed request must not reset an already approved/declined approval.
      if (state.live[action.sessionId]?.approval?.id === action.approval.id) {
        return state;
      }
      return updateLive(
        state,
        action.sessionId,
        (live) => ({ ...live, approval: action.approval }),
        true,
      );

    case "APPROVAL_RESOLVED":
      return updateLive(
        state,
        action.sessionId,
        (live) =>
          live.approval
            ? {
                ...live,
                approval: {
                  ...live.approval,
                  status: action.approved ? "approved" : "declined",
                  deliveryUrl: action.deliveryUrl ?? live.approval.deliveryUrl,
                },
              }
            : live,
        true,
      );

    case "LIVE_CONNECTION_CHANGED":
      return updateLive(state, action.sessionId, (live) => ({
        ...live,
        connectionStatus: action.status,
      }));

    case "SESSION_FRAME_UPDATED":
      // Newest-frame-wins; drop stale/out-of-order frames. The previous image
      // stays on screen until a newer one arrives.
      if (state.live[action.sessionId] && (state.live[action.sessionId].frame?.seq ?? -1) > action.frame.seq) {
        return state;
      }
      return updateLive(state, action.sessionId, (live) => ({
        ...live,
        frame: action.frame,
      }));

    case "LIVE_SESSION_INITIALIZED":
      return {
        ...state,
        live: { ...state.live, [action.sessionId]: emptyLiveSession() },
      };

    case "FILE_REGISTERED":
      return { ...state, files: [action.file, ...state.files] };

    case "STATE_IMPORTED":
      return {
        ...state,
        computers: action.fixture.computers,
        sessions: action.fixture.sessions,
        files: action.fixture.files,
        live: action.fixture.live,
        activeComputerId: action.fixture.activeComputerId,
        loading: { computers: false, sessions: false, files: false },
        errors: { computers: null, sessions: null, files: null },
      };

    case "STATE_RESET":
      return {
        ...initialState,
        loading: { computers: false, sessions: false, files: false },
      };

    case "PREFERENCES_CHANGED":
      return { ...state, preferences: { ...state.preferences, ...action.patch } };

    case "ACTIVE_COMPUTER_CHANGED":
      return { ...state, activeComputerId: action.computerId };

    default:
      return state;
  }
}
