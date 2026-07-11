import type { ID, SessionState } from "@/types/common";
import type { AccessMode } from "@/features/access/types";

export interface Session {
  id: ID;
  name: string;
  detail: string;
  lastActive: string;
  computerId: ID;
  status: string;
  state: SessionState;
  accessMode: AccessMode;
}
