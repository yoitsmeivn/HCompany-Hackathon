import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ArtifactStore } from "./artifactStore.js";
import { FileSearch } from "./fileSearch.js";

async function fixture(files: Array<{ name: string; ageMs?: number }>): Promise<{ desktop: string; documents: string; search: FileSearch }> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-search-"));
  const desktop = path.join(base, "Desktop");
  const documents = path.join(base, "Documents");
  await fs.mkdir(desktop);
  await fs.mkdir(documents);
  const now = Date.now();
  for (const f of files) {
    const full = path.join(desktop, f.name);
    await fs.writeFile(full, Buffer.alloc(64, 1));
    if (f.ageMs) await fs.utimes(full, new Date(now - f.ageMs), new Date(now - f.ageMs));
  }
  const store = new ArtifactStore([desktop, documents], 15_000_000);
  return { desktop, documents, search: new FileSearch([desktop, documents], store) };
}

test("finds a file by semantic query and registers it as an artifact", async () => {
  const { search } = await fixture([{ name: "IvanSeverinovResumeBlackRock.pdf" }, { name: "cat.png" }]);
  const matches = await search.search({ query: "resume" }, "s1");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].displayName, "IvanSeverinovResumeBlackRock.pdf");
  assert.ok(matches[0].artifactId.startsWith("art-"), "returns an artifactId, not a path");
  assert.ok(!JSON.stringify(matches[0]).includes("/Users") && !JSON.stringify(matches[0]).includes(os.tmpdir()), "no local path leaks");
});

test("matches an exact filename query", async () => {
  const { search } = await fixture([{ name: "IvanSeverinovResumeBlackRock.pdf" }, { name: "IvanSeverinovResumeMistral.pdf" }]);
  const matches = await search.search({ query: "IvanSeverinovResumeBlackRock.pdf" }, "s1");
  assert.equal(matches[0].displayName, "IvanSeverinovResumeBlackRock.pdf");
});

test("finds files with spaces in the name (screenshots)", async () => {
  const { search } = await fixture([{ name: "Screen Shot 2026-07-12 at 10.00.png" }, { name: "notes.txt" }]);
  const matches = await search.search({ query: "screenshot" }, "s1");
  assert.equal(matches.length, 1);
  assert.match(matches[0].displayName, /Screen Shot/);
});

test("filters by extension and sorts by modified_desc", async () => {
  const { search } = await fixture([
    { name: "old.pdf", ageMs: 100_000 },
    { name: "new.pdf", ageMs: 1_000 },
    { name: "image.png" },
  ]);
  const matches = await search.search({ query: "pdf", extensions: ["pdf"], sortBy: "modified_desc" }, "s1");
  assert.deepEqual(matches.map((m) => m.displayName), ["new.pdf", "old.pdf"]);
});

test("respects the limit", async () => {
  const files = Array.from({ length: 8 }, (_, i) => ({ name: `report-${i}.pdf` }));
  const { search } = await fixture(files);
  const matches = await search.search({ query: "report", limit: 3 }, "s1");
  assert.equal(matches.length, 3);
});

test("only searches the requested root", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-search-"));
  const desktop = path.join(base, "Desktop");
  const documents = path.join(base, "Documents");
  await fs.mkdir(desktop);
  await fs.mkdir(documents);
  await fs.writeFile(path.join(desktop, "desk-resume.pdf"), Buffer.alloc(64, 1));
  await fs.writeFile(path.join(documents, "docs-resume.pdf"), Buffer.alloc(64, 1));
  const store = new ArtifactStore([desktop, documents], 15_000_000);
  const search = new FileSearch([desktop, documents], store);
  const matches = await search.search({ query: "resume", roots: ["documents"] }, "s1");
  assert.deepEqual(matches.map((m) => m.displayName), ["docs-resume.pdf"]);
});

test("returns nothing when no file matches", async () => {
  const { search } = await fixture([{ name: "cat.png" }]);
  const matches = await search.search({ query: "resume", extensions: ["pdf"] }, "s1");
  assert.equal(matches.length, 0);
});
