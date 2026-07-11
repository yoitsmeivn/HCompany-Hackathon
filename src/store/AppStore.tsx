import { useEffect, useReducer, useRef, type ReactNode } from "react";
import * as computersService from "@/services/computersService";
import * as sessionsService from "@/services/sessionsService";
import * as filesService from "@/services/filesService";
import * as preferencesService from "@/services/preferencesService";
import * as persistence from "./persistence";
import { DispatchContext, StateContext } from "./context";
import { initialState } from "./initialState";
import { reducer } from "./reducer";

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrated = useRef(false);

  // Hydrate through the service boundary. When the Express backend lands,
  // the services fetch instead and this component does not change.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      computersService.list(),
      sessionsService.list(),
      filesService.list(),
      preferencesService.get(),
    ])
      .then(([computers, sessions, files, prefs]) => {
        if (cancelled) return;
        dispatch({
          type: "HYDRATED",
          computers,
          sessions,
          files,
          activeComputerId: prefs.activeComputerId,
          preferences: prefs.preferences,
        });
        hydrated.current = true;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load saved data.";
        for (const collection of ["computers", "sessions", "files"] as const) {
          dispatch({ type: "LOAD_FAILED", collection, error: message });
        }
        hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist safe metadata only (see persistence.ts) after hydration.
  useEffect(() => {
    if (hydrated.current) persistence.save(state);
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}
