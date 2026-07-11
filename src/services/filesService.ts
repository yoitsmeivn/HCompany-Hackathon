import type { FileItem, FileKind } from "@/features/files/types";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import * as persistence from "@/store/persistence";
import { resolve } from "./api";

// Local adapter — future: GET /api/files
export function list(): Promise<FileItem[]> {
  return resolve(persistence.load()?.files ?? []);
}

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: "pdf",
  ppt: "pptx",
  pptx: "pptx",
  key: "pptx",
  doc: "docx",
  docx: "docx",
  txt: "docx",
  md: "docx",
  xls: "xlsx",
  xlsx: "xlsx",
  csv: "xlsx",
  numbers: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  heic: "image",
  webp: "image",
};

function kindFromName(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return KIND_BY_EXTENSION[ext] ?? "other";
}

// Files picked in the browser are NOT files the Kylian companion touched on a
// computer — they are honestly labelled as browser uploads with no computerId.
// Only metadata is extracted; the File objects themselves stay in ephemeral
// memory and are never stored.
export function filesFromSelection(fileList: FileList): FileItem[] {
  return Array.from(fileList).map((file) => ({
    id: newId("file"),
    name: file.name,
    kind: kindFromName(file.name),
    location: "Uploaded from this device",
    lastAccessedAt: nowIso(),
    action: "uploaded",
    status: "available",
    source: "browser-upload",
  }));
}
