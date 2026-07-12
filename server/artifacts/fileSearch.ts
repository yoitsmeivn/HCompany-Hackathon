import { promises as fs } from "node:fs";
import path from "node:path";
import type { ArtifactStore, ArtifactSummary } from "./artifactStore.js";

// Deterministic host-side file search over the configured artifact roots, using
// only Node's filesystem APIs — no Terminal, shell, Spotlight, Finder, or
// HoloDesktop. Matches are registered as transferable artifacts so the model
// receives artifactIds (never paths) and can deliver them via Twilio/Gmail.

const MAX_DEPTH = 4;
const MAX_ENTRIES = 8000;
const SKIP_DIRS = new Set(["node_modules", "Library", ".git", ".Trash", "__pycache__"]);

// Semantic filename hints → the tokens that count as a match for that hint.
const SYNONYMS: Record<string, string[]> = {
  resume: ["resume", "cv", "curriculumvitae"],
  cv: ["cv", "resume"],
  screenshot: ["screenshot", "screenshots", "screen", "cleanshot", "capture", "screencap"],
  invoice: ["invoice", "receipt", "bill"],
  photo: ["photo", "img", "image", "picture", "pic"],
};

export type FileSortBy = "relevance" | "modified_desc" | "modified_asc" | "name_asc";

export interface FileSearchRequest {
  query: string;
  roots?: Array<"desktop" | "documents">;
  extensions?: string[];
  sortBy?: FileSortBy;
  limit?: number;
}

/** Model-facing match: an artifact plus safe ordering hints (no local path). */
export interface FileMatch extends ArtifactSummary {
  modifiedAt: string;
}

interface Candidate {
  fullPath: string;
  name: string;
  mtimeMs: number;
  score: number;
}

export class FileSearch {
  constructor(
    private readonly allowedRoots: string[],
    private readonly store: ArtifactStore,
  ) {}

  async search(request: FileSearchRequest, sessionId: string): Promise<FileMatch[]> {
    const roots = this.selectRoots(request.roots);
    const extensions = normalizeExtensions(request.extensions);
    const tokens = expandQuery(request.query);
    const limit = clamp(request.limit ?? 10, 1, 20);

    const candidates: Candidate[] = [];
    let budget = MAX_ENTRIES;
    for (const root of roots) {
      budget = await this.walk(root, 0, extensions, tokens, request.query, candidates, budget);
    }

    sortCandidates(candidates, request.sortBy ?? "relevance");

    const matches: FileMatch[] = [];
    for (const candidate of candidates) {
      if (matches.length >= limit) break;
      // register re-validates realpath/root/size/mtime and mints the capability.
      const summary = await this.store.register(sessionId, candidate.fullPath);
      if (summary) matches.push({ ...summary, modifiedAt: new Date(candidate.mtimeMs).toISOString() });
    }
    return matches;
  }

  private selectRoots(requested?: Array<"desktop" | "documents">): string[] {
    if (!requested || requested.length === 0) return this.allowedRoots;
    const wanted = new Set(requested.map((entry) => entry.toLowerCase()));
    const picked = this.allowedRoots.filter((root) => wanted.has(path.basename(root).toLowerCase()));
    return picked.length > 0 ? picked : this.allowedRoots;
  }

  private async walk(
    dir: string,
    depth: number,
    extensions: string[] | null,
    tokens: string[],
    rawQuery: string,
    out: Candidate[],
    budget: number,
  ): Promise<number> {
    if (depth > MAX_DEPTH || budget <= 0) return budget;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return budget;
    }
    for (const entry of entries) {
      if (budget <= 0) break;
      budget -= 1;
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        budget = await this.walk(full, depth + 1, extensions, tokens, rawQuery, out, budget);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions && !extensions.includes(ext)) continue;
      const score = scoreName(entry.name, tokens, rawQuery);
      if (score <= 0 && (tokens.length > 0 || !extensions)) continue;
      let mtimeMs = 0;
      try {
        mtimeMs = (await fs.stat(full)).mtimeMs;
      } catch {
        continue;
      }
      out.push({ fullPath: full, name: entry.name, mtimeMs, score });
    }
    return budget;
  }
}

function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/[\s_.\-]+/).filter(Boolean);
  const expanded = new Set<string>();
  for (const word of words) {
    expanded.add(word);
    for (const synonym of SYNONYMS[word] ?? []) expanded.add(synonym);
  }
  return [...expanded];
}

function scoreName(name: string, tokens: string[], rawQuery: string): number {
  const flatBase = normalize(path.basename(name, path.extname(name)));
  const flatFull = normalize(name);
  const q = normalize(rawQuery);
  if (q.length > 0) {
    if (flatBase === q || flatFull === q) return 100; // exact filename
    if (flatFull.includes(q)) return 60; // full query is a substring
  }
  if (tokens.length === 0) return 1; // extension-only search
  if (tokens.some((token) => flatFull.includes(normalize(token)))) return 30;
  return 0;
}

function sortCandidates(candidates: Candidate[], sortBy: FileSortBy): void {
  candidates.sort((a, b) => {
    switch (sortBy) {
      case "modified_desc": return b.mtimeMs - a.mtimeMs;
      case "modified_asc": return a.mtimeMs - b.mtimeMs;
      case "name_asc": return a.name.localeCompare(b.name);
      default: return b.score - a.score || b.mtimeMs - a.mtimeMs;
    }
  });
}

function normalizeExtensions(extensions?: string[]): string[] | null {
  if (!extensions || extensions.length === 0) return null;
  return extensions.map((ext) => {
    const lower = ext.trim().toLowerCase();
    return lower.startsWith(".") ? lower : `.${lower}`;
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_.\-]+/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
