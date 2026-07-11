import type { Session } from "@/features/sessions/types";
import * as persistence from "@/store/persistence";
import { resolve } from "./api";

// Local adapter — future: GET /api/sessions
export function list(): Promise<Session[]> {
  return resolve(persistence.load()?.sessions ?? []);
}

// Future: POST /api/sessions
export function create(session: Session): Promise<Session> {
  return resolve(session);
}
