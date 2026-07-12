import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ArtifactError, ArtifactStore } from "./artifactStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "kylian-artifacts-"));
}

async function writePdf(dir: string, name = "resume.pdf", bytes = 1024): Promise<string> {
  const file = path.join(dir, name);
  await fs.writeFile(file, Buffer.alloc(bytes, 1));
  return file;
}

test("registers a valid file and exposes only safe fields", async () => {
  const root = await tempRoot();
  const file = await writePdf(root);
  const store = new ArtifactStore([root], 15_000_000);
  const summary = await store.register("s1", file);
  assert.ok(summary);
  assert.deepEqual(Object.keys(summary).sort(), ["artifactId", "displayName", "mimeType", "sizeBytes"]);
  assert.equal(summary.displayName, "resume.pdf");
  assert.equal(summary.mimeType, "application/pdf");
  assert.ok(!JSON.stringify(summary).includes(root), "local path never surfaces to the model");
});

test("rejects files outside the allowed roots", async () => {
  const root = await tempRoot();
  const other = await tempRoot();
  const outside = await writePdf(other);
  const store = new ArtifactStore([root], 15_000_000);
  assert.equal(await store.register("s1", outside), null);
});

test("rejects path traversal outside the allowed root", async () => {
  const root = await tempRoot();
  await writePdf(root);
  const store = new ArtifactStore([root], 15_000_000);
  assert.equal(await store.register("s1", path.join(root, "..", "etc", "passwd.pdf")), null);
});

test("registers arbitrary file types inside the root (delivered as a link, not media)", async () => {
  const { isTwilioMediaSupported } = await import("./artifactStore.js");
  const root = await tempRoot();
  const store = new ArtifactStore([root], 15_000_000);
  const txt = path.join(root, "note.txt");
  await fs.writeFile(txt, "hi");
  const summary = await store.register("s1", txt);
  assert.ok(summary, "any regular file registers now");
  assert.equal(summary!.mimeType, "text/plain");
  assert.equal(isTwilioMediaSupported(summary!.mimeType), false, ".txt is not native WhatsApp media");
  assert.equal(isTwilioMediaSupported("application/pdf"), true);
});

test("rejects a symlink that escapes the allowed root", async () => {
  const root = await tempRoot();
  const other = await tempRoot();
  const realOutside = await writePdf(other, "secret.pdf");
  const link = path.join(root, "link.pdf");
  await fs.symlink(realOutside, link);
  const store = new ArtifactStore([root], 15_000_000);
  assert.equal(await store.register("s1", link), null, "realpath escapes the root, so it is rejected");
});

test("rejects oversized and missing files", async () => {
  const root = await tempRoot();
  const big = await writePdf(root, "big.pdf", 2048);
  const store = new ArtifactStore([root], 1024);
  assert.equal(await store.register("s1", big), null);
  assert.equal(await store.register("s1", path.join(root, "nope.pdf")), null);
});

test("resolveForDelivery enforces session ownership", async () => {
  const root = await tempRoot();
  const file = await writePdf(root);
  const store = new ArtifactStore([root], 15_000_000);
  const summary = await store.register("s1", file);
  await assert.rejects(() => store.resolveForDelivery("s2", summary!.artifactId), ArtifactError);
  const record = await store.resolveForDelivery("s1", summary!.artifactId);
  assert.equal(record.localPath, await fs.realpath(file));
});

test("resolveForDelivery blocks a file changed since registration", async () => {
  const root = await tempRoot();
  const file = await writePdf(root);
  const store = new ArtifactStore([root], 15_000_000);
  const summary = await store.register("s1", file);
  await fs.writeFile(file, Buffer.alloc(4096, 2)); // size + mtime change
  await assert.rejects(() => store.resolveForDelivery("s1", summary!.artifactId), /changed on disk/);
});

test("extractArtifacts registers file paths mentioned in executor text", async () => {
  const root = await tempRoot();
  await writePdf(root, "IvanResume.pdf");
  const store = new ArtifactStore([root], 15_000_000);
  const filePath = path.join(root, "IvanResume.pdf");
  const text = `I found the file at ${filePath} and stopped.`;
  const { artifacts, scrubbedText } = await store.extractArtifacts("s1", text);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].displayName, "IvanResume.pdf");
  assert.ok(!scrubbedText.includes(filePath), "the path is scrubbed from the returned text");
  assert.match(scrubbedText, /IvanResume\.pdf/);
});
