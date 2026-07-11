import type { ComputerStatus, ID } from "@/types/common";
import type { AccessPolicy } from "@/features/access/types";

export interface Computer {
  id: ID;
  name: string;
  model: string;
  os: string;
  status: ComputerStatus;
  lastSeen: string;
  access: AccessPolicy;
}
