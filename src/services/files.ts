import type { FileItem } from "@/features/files/types";
import type { ID } from "@/types/common";
import { MOCK_FILES } from "@/data/mockFiles";
import { resolve } from "./api";

export function listFiles(filter?: { computerId?: ID }): Promise<FileItem[]> {
  const files = filter?.computerId
    ? MOCK_FILES.filter((f) => f.computerId === filter.computerId)
    : MOCK_FILES;
  return resolve(files);
}
