import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ArtifactPipelineError, type ArtifactErrorCode } from "./errorCodes.js";

// Server-side artifact capabilities. HoloDesktop reports located files (as a
// structured payload, or as free text as a fallback); the SERVER validates
// every path and hands the model only opaque artifact ids — the model is never
// trusted with local paths. Every capability is session-scoped, time-boxed,
// and re-validated (including an unchanged size+mtime check) before delivery.

const ARTIFACT_TTL_MS = 15 * 60 * 1000;
const STORE_MAX = 200;

// Any regular file may be registered; unknown extensions fall back to
// octet-stream (delivered as a secure link rather than native media).
const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

// Extensions the free-text fallback scanner will look for (structured payloads
// are not limited to these).
const SCAN_EXTENSIONS = Object.keys(MIME_BY_EXTENSION).map((extension) => extension.slice(1));

// MIME types Twilio can deliver as native WhatsApp media; everything else is
// sent as a secure download link.
const TWILIO_MEDIA_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);

export function isTwilioMediaSupported(mimeType: string): boolean {
  return TWILIO_MEDIA_MIME.has(mimeType);
}

export interface ArtifactRecord {
  artifactId: string;
  sessionId: string;
  localPath: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: number;
  expiresAt: number;
  // Set on server-derived artifacts (e.g. a ZIP): the source artifactIds.
  derivedFrom?: string[];
}

/** The only shape the model ever sees. */
export interface ArtifactSummary {
  artifactId: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
}

export class ArtifactStore {
  private readonly records = new Map<string, ArtifactRecord>();
  private resolvedRoots?: Promise<string[]>;

  constructor(
    private readonly allowedRoots: string[],
    private readonly maxBytes: number,
  ) {}

  // Roots are resolved through realpath so symlinked roots (e.g. macOS
  // /var → /private/var) match realpath'd file paths. Missing roots drop out.
  private async roots(): Promise<string[]> {
    if (!this.resolvedRoots) {
      this.resolvedRoots = Promise.all(
        this.allowedRoots.map(async (root) => {
          try { return await fs.realpath(root); } catch { return root; }
        }),
      );
    }
    return this.resolvedRoots;
  }

  /** Register a discovered file; returns null when the path fails validation. */
  async register(sessionId: string, candidatePath: string): Promise<ArtifactSummary | null> {
    const outcome = await this.registerWithReason(sessionId, candidatePath);
    return "artifact" in outcome ? outcome.artifact : null;
  }

  /**
   * Register a file and report a structured error code on failure — used by the
   * structured (holo ARTIFACTS_JSON) path so the model can speak one precise
   * reason. Validation is identical to the fallback path.
   */
  async registerWithReason(
    sessionId: string,
    candidatePath: string,
  ): Promise<{ artifact: ArtifactSummary } | { code: ArtifactErrorCode }> {
    const validated = await this.validatePathWithReason(candidatePath);
    if ("code" in validated) return validated;
    const artifactId = `art-${randomBytes(16).toString("hex")}`;
    const full: ArtifactRecord = { ...validated.record, artifactId, sessionId, expiresAt: Date.now() + ARTIFACT_TTL_MS };
    this.records.set(artifactId, full);
    if (this.records.size > STORE_MAX) {
      const oldest = this.records.keys().next().value;
      if (oldest !== undefined) this.records.delete(oldest);
    }
    return { artifact: summarize(full) };
  }

  /**
   * Register a file the SERVER created (e.g. a generated ZIP under its own temp
   * dir). Root containment is not required — the server chose the path — but
   * realpath/regular-file/size are still validated. Records provenance.
   */
  async registerServerFile(
    sessionId: string,
    serverPath: string,
    displayName: string,
    derivedFrom: string[],
  ): Promise<ArtifactSummary> {
    let realPath: string;
    let stats: import("node:fs").Stats;
    try {
      realPath = await fs.realpath(serverPath);
      stats = await fs.stat(realPath);
    } catch {
      throw new ArtifactPipelineError("artifact_missing");
    }
    if (!stats.isFile() || stats.size <= 0 || stats.size > this.maxBytes) throw new ArtifactPipelineError("artifact_parse_failed");
    const extension = path.extname(displayName).toLowerCase();
    const artifactId = `art-${randomBytes(16).toString("hex")}`;
    const full: ArtifactRecord = {
      artifactId,
      sessionId,
      localPath: realPath,
      displayName,
      mimeType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
      sizeBytes: stats.size,
      modifiedAt: stats.mtimeMs,
      expiresAt: Date.now() + ARTIFACT_TTL_MS,
      derivedFrom,
    };
    this.records.set(artifactId, full);
    return summarize(full);
  }

  /**
   * Resolve a capability for delivery: ownership, expiry, and the file being
   * unchanged since registration are all enforced. Throws with a safe message.
   */
  async resolveForDelivery(sessionId: string, artifactId: string): Promise<ArtifactRecord> {
    const record = this.records.get(artifactId);
    if (!record || record.sessionId !== sessionId) throw new ArtifactPipelineError("artifact_missing", "Unknown artifact for this session");
    if (Date.now() > record.expiresAt) throw new ArtifactPipelineError("artifact_changed", "Artifact capability expired; locate the file again");
    let stats: import("node:fs").Stats;
    try {
      stats = await fs.stat(record.localPath);
    } catch {
      throw new ArtifactPipelineError("artifact_missing");
    }
    if (!stats.isFile()) throw new ArtifactPipelineError("artifact_missing");
    // Server-derived files (ZIPs) live outside the user's allowed roots by
    // design; only user-located files must re-pass the root check.
    if (!record.derivedFrom) {
      const roots = await this.roots();
      if (!roots.some((root) => isWithin(root, record.localPath))) throw new ArtifactPipelineError("artifact_outside_allowed_root");
    }
    if (stats.size !== record.sizeBytes || stats.mtimeMs !== record.modifiedAt) {
      throw new ArtifactPipelineError("artifact_changed", "Artifact changed on disk since it was located; locate it again");
    }
    return record;
  }

  /**
   * Extract and register allowed-root file paths mentioned in executor free
   * text, and return the summaries plus a copy of the text with those paths
   * replaced by display names — so the model never receives a local path.
   */
  async extractArtifacts(sessionId: string, text: string): Promise<{ artifacts: ArtifactSummary[]; scrubbedText: string }> {
    const pattern = new RegExp(String.raw`(/[\w.@ ~()\[\]-]+(?:/[\w.@ ~()\[\]-]+)*\.(?:${SCAN_EXTENSIONS.join("|")}))\b`, "gi");
    const seen = new Set<string>();
    const artifacts: ArtifactSummary[] = [];
    let scrubbedText = text;
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1].trim();
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const summary = await this.register(sessionId, candidate);
      if (summary) {
        artifacts.push(summary);
        scrubbedText = scrubbedText.split(candidate).join(summary.displayName);
      }
      if (artifacts.length >= 5) break;
    }
    return { artifacts, scrubbedText };
  }

  private async validatePathWithReason(
    candidatePath: string,
  ): Promise<{ record: Omit<ArtifactRecord, "artifactId" | "sessionId" | "expiresAt"> } | { code: ArtifactErrorCode }> {
    const extension = path.extname(candidatePath).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
    let realPath: string;
    let stats: import("node:fs").Stats;
    try {
      // realpath resolves symlinks, so a link inside a root pointing outside fails the root check.
      realPath = await fs.realpath(candidatePath);
      stats = await fs.stat(realPath);
    } catch {
      return { code: "artifact_missing" };
    }
    if (!stats.isFile()) return { code: "artifact_missing" };
    if (stats.size <= 0 || stats.size > this.maxBytes) return { code: "artifact_parse_failed" };
    const roots = await this.roots();
    if (!roots.some((root) => isWithin(root, realPath))) return { code: "artifact_outside_allowed_root" };
    return {
      record: {
        localPath: realPath,
        displayName: path.basename(realPath),
        mimeType,
        sizeBytes: stats.size,
        modifiedAt: stats.mtimeMs,
      },
    };
  }
}

// Back-compat alias; ArtifactPipelineError (with codes) is the real type thrown.
export { ArtifactPipelineError as ArtifactError } from "./errorCodes.js";

export function defaultAllowedRoots(): string[] {
  const home = os.homedir();
  return [path.join(home, "Documents"), path.join(home, "Desktop")];
}

export function parseAllowedRoots(raw: string | undefined): string[] {
  const roots = (raw ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return (roots.length > 0 ? roots : defaultAllowedRoots()).map((root) => path.resolve(root));
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function summarize(record: ArtifactRecord): ArtifactSummary {
  return {
    artifactId: record.artifactId,
    displayName: record.displayName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
  };
}
