import type { ID } from "@/types/common";

export type FileKind = "pdf" | "pptx" | "docx" | "xlsx" | "image" | "other";

export type FileAction = "opened" | "previewed" | "located" | "delivered" | "uploaded";

export type FileStatus = "available" | "delivered" | "expired" | "permission-required";

export type FileSource = "browser-upload" | "companion" | "demo";

export interface FileItem {
  id: ID;
  name: string;
  kind: FileKind;
  location: string;
  computerId?: ID;
  lastAccessedAt: string;
  action: FileAction;
  status: FileStatus;
  source: FileSource;
  sessionId?: ID;
}

export const FILE_ACTION_LABELS: Record<FileAction, string> = {
  opened: "Opened",
  previewed: "Previewed",
  located: "Located",
  delivered: "Delivered",
  uploaded: "Uploaded",
};

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  available: "Available",
  delivered: "Delivered",
  expired: "Expired",
  "permission-required": "Permission required",
};
