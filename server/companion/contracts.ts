import type { ComputerTaskAdapter } from "../computer/types.js";

export interface CompanionConnection {
  computerId: string;
  connectedAt: string;
  send(message: CompanionOutboundMessage): Promise<void>;
}

export type CompanionOutboundMessage =
  | { type: "task.start"; taskId: string; instruction: string }
  | { type: "task.steer"; taskId: string; instruction: string }
  | { type: "task.pause"; taskId: string }
  | { type: "task.stop"; taskId: string };

export type LocalCompanionTaskAdapter = ComputerTaskAdapter;
