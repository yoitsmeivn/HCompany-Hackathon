import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ArtifactStore } from "./artifactStore.js";
import { ArtifactPublisher } from "./artifactPublisher.js";

const BASE = "https://tunnel.example.com";

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-pub-"));
  const file = path.join(root, "doc.pdf");
  await fs.writeFile(file, Buffer.alloc(1024, 1));
  const store = new ArtifactStore([root], 15_000_000);
  const summary = await store.register("s1", file);
  return { store, publisher: new ArtifactPublisher(store, BASE), artifactId: summary!.artifactId };
}

test("publishes a single-use signed URL on the tunnel", async () => {
  const { publisher, artifactId } = await setup();
  const result = await publisher.publishArtifact({ sessionId: "s1", artifactId });
  assert.match(result.signedUrl, /^https:\/\/tunnel\.example\.com\/api\/artifacts\/[a-f0-9]{64}$/);
  assert.equal(result.objectKey.length, 64);
  assert.ok(new Date(result.expiresAt).getTime() > Date.now());
});

test("redeem returns the record once, then never again", async () => {
  const { publisher, artifactId } = await setup();
  const { objectKey } = await publisher.publishArtifact({ sessionId: "s1", artifactId });
  const first = await publisher.redeem(objectKey);
  assert.ok(first);
  assert.equal(first!.displayName, "doc.pdf");
  assert.equal(await publisher.redeem(objectKey), null, "second redemption is refused (single use)");
});

test("redeem refuses unknown tokens", async () => {
  const { publisher } = await setup();
  assert.equal(await publisher.redeem("0".repeat(64)), null);
  assert.equal(await publisher.redeem("short"), null);
});

test("publishing requires an https base url", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-pub-"));
  const file = path.join(root, "doc.pdf");
  await fs.writeFile(file, Buffer.alloc(512, 1));
  const store = new ArtifactStore([root], 15_000_000);
  const summary = await store.register("s1", file);
  const publisher = new ArtifactPublisher(store, "http://localhost:8787");
  await assert.rejects(() => publisher.publishArtifact({ sessionId: "s1", artifactId: summary!.artifactId }), /https/);
});

test("revokeArtifact invalidates outstanding tokens", async () => {
  const { publisher, artifactId } = await setup();
  const { objectKey } = await publisher.publishArtifact({ sessionId: "s1", artifactId });
  publisher.revokeArtifact(artifactId);
  assert.equal(await publisher.redeem(objectKey), null);
});
