import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { ArtifactStore, ArtifactSummary } from "./artifactStore.js";
import { ArtifactPipelineError } from "./errorCodes.js";

// Server-side ZIP creation for multi-file delivery. Uses the maintained
// `archiver` library (no shell). Sources are resolved+validated through the
// ArtifactStore first; the resulting ZIP is registered as a derived artifact
// with provenance and delivered like any other file.

const DEFAULT_ZIP_MAX_BYTES = 15 * 1024 * 1024;

export class ZipService {
  constructor(
    private readonly store: ArtifactStore,
    private readonly maxBytes = DEFAULT_ZIP_MAX_BYTES,
    private readonly tmpDir = path.join(os.tmpdir(), "kylian-zips"),
  ) {}

  async zipArtifacts(sessionId: string, artifactIds: string[], zipName = "files.zip"): Promise<ArtifactSummary> {
    if (artifactIds.length === 0) throw new ArtifactPipelineError("artifact_missing", "No files to zip");
    // Resolve + validate every source before writing anything.
    const sources = [];
    let total = 0;
    for (const id of artifactIds) {
      const record = await this.store.resolveForDelivery(sessionId, id);
      total += record.sizeBytes;
      if (total > this.maxBytes) throw new ArtifactPipelineError("artifact_parse_failed", "The combined files are too large to zip");
      sources.push(record);
    }

    await fs.mkdir(this.tmpDir, { recursive: true });
    const outPath = path.join(this.tmpDir, `${randomBytes(12).toString("hex")}.zip`);
    await this.writeZip(outPath, sources.map((s) => ({ localPath: s.localPath, name: s.displayName })));

    const displayName = zipName.toLowerCase().endsWith(".zip") ? zipName : `${zipName}.zip`;
    return this.store.registerServerFile(sessionId, outPath, displayName, artifactIds);
  }

  private writeZip(outPath: string, entries: Array<{ localPath: string; name: string }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);
      for (const entry of entries) archive.file(entry.localPath, { name: entry.name });
      void archive.finalize();
    });
  }
}
