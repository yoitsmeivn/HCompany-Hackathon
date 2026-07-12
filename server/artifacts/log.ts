import path from "node:path";

// Safe structured logging for the artifact/delivery pipeline. Logs metadata
// only — never tokens, signed URLs, or full private paths. Paths are reduced to
// "<parentdir-basename>/<filename>" so support can correlate without leaking
// the user's directory structure.

export interface ArtifactLogFields {
  turnId?: string;
  taskId?: string;
  code?: string;
  stage: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  delivery?: string;
}

export function logArtifactStage(fields: ArtifactLogFields): void {
  const safe: Record<string, unknown> = { stage: fields.stage };
  for (const key of ["turnId", "taskId", "code", "mimeType", "sizeBytes", "delivery"] as const) {
    if (fields[key] !== undefined) safe[key] = fields[key];
  }
  if (fields.filename) safe.filename = path.basename(fields.filename);
  console.log(`[artifacts] ${JSON.stringify(safe)}`);
}
