import type { ID } from "@/types/common";

export type Message = {
  id: ID;
  who: string;
  side: "user" | "agent";
  text: string;
  at: string;
};

export interface ActivityEvent {
  id: ID;
  label: string;
  at: string;
  state: "done" | "current" | "pending";
}

export interface CandidateFile {
  id: ID;
  name: string;
  meta: string;
  ext: string;
  evidence?: string;
}

export interface ApprovalRequest {
  id: ID;
  summary: string;
  fileName: string;
  status: "pending" | "approved" | "declined";
  deliveryUrl?: string;
}

export interface LiveFeedInfo {
  task?: string;
  currentApp?: string;
  action?: string;
  permission?: string;
}

export type LiveConnectionStatus = "connecting" | "connected" | "disconnected" | "failed";

// The latest desktop screenshot for a session. Abstract on purpose: a future
// video provider (LiveKit/WebRTC) can replace how this is populated without the
// UI changing anything but the element it renders.
export interface LiveFrame {
  src: string;
  seq: number;
}

export interface LiveSessionData {
  messages: Message[];
  activity: ActivityEvent[];
  candidates: CandidateFile[];
  approval: ApprovalRequest | null;
  feed: LiveFeedInfo | null;
  frame: LiveFrame | null;
  connectionStatus: LiveConnectionStatus;
  selectedCandidateId: ID | null;
}
