import type { ID } from "@/types/common";

export type FileKind = "pdf" | "pptx" | "docx" | "xlsx" | "image";

export type FileAction = "opened" | "previewed" | "located" | "delivered";

export type FileStatus = "available" | "delivered" | "expired" | "permission-required";

export interface FileItem {
  id: ID;
  name: string;
  kind: FileKind;
  location: string;
  computerId: ID;
  lastAccessed: string;
  action: FileAction;
  status: FileStatus;
  sessionId?: ID;
}

export const FILE_ACTION_LABELS: Record<FileAction, string> = {
  opened: "Opened",
  previewed: "Previewed",
  located: "Located",
  delivered: "Delivered",
};

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  available: "Available",
  delivered: "Delivered",
  expired: "Expired",
  "permission-required": "Permission required",
};
