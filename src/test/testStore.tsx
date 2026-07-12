/* eslint-disable react-refresh/only-export-components -- test-only helpers, fast refresh does not apply */
import { useReducer, type ReactNode } from "react";
import type { Session } from "@/features/sessions/types";
import { DispatchContext, StateContext } from "@/store/context";
import { initialState, type AppState } from "@/store/initialState";
import { reducer } from "@/store/reducer";

export function makeSession(id: string, patch: Partial<Session> = {}): Session {
  return {
    id,
    name: `Call ${id}`,
    detail: "Test session",
    lastActiveAt: "2026-07-12T10:00:00.000Z",
    computerId: "c1",
    status: "Active",
    state: "active",
    accessMode: "ask",
    ...patch,
  };
}

export function seedState(sessions: Session[]): AppState {
  return {
    ...initialState,
    sessions,
    loading: { computers: false, sessions: false, files: false },
  };
}

// Wires the real reducer into the real store contexts, skipping
// AppStoreProvider's service hydration.
export function TestStoreProvider({
  seed,
  children,
}: {
  seed: AppState;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, seed);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}
