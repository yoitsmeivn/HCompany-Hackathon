import { createContext, useContext, type Dispatch } from "react";
import type { AppAction } from "./actions";
import type { AppState } from "./initialState";

export const StateContext = createContext<AppState | null>(null);
export const DispatchContext = createContext<Dispatch<AppAction> | null>(null);

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useAppState must be used inside <AppStoreProvider>");
  return state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useAppDispatch must be used inside <AppStoreProvider>");
  return dispatch;
}
