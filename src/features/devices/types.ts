import type { ComputerStatus, ID } from "@/types/common";
import type { AccessPolicy } from "@/features/access/types";

export interface Computer {
  id: ID;
  name: string;
  model?: string;
  os?: string;
  status: ComputerStatus;
  lastSeenAt: string | null;
  access: AccessPolicy;
}

export const COMPUTER_STATUS_LABELS: Record<ComputerStatus, string> = {
  configured: "Configured",
  connecting: "Connecting",
  connected: "Connected",
  offline: "Offline",
};
