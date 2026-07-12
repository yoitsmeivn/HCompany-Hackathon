import assert from "node:assert/strict";
import { test } from "node:test";
import type { RuntimeEventEnvelope } from "../../shared/runtimeEvents.js";
import { RuntimeEventHub } from "./eventHub.js";

function emitThree(hub: RuntimeEventHub): RuntimeEventEnvelope[] {
  return ["one", "two", "three"].map((text) =>
    hub.emit({ kind: "agent-message", sessionId: "s1", text }),
  );
}

test("replays only events after the given afterId", () => {
  const hub = new RuntimeEventHub();
  const [, second, third] = emitThree(hub);

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true, second.id);

  assert.deepEqual(received.map((e) => e.id), [third.id]);
});

test("falls back to a full replay when afterId is unknown or evicted", () => {
  const hub = new RuntimeEventHub();
  const emitted = emitThree(hub);

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true, "no-such-id");

  assert.deepEqual(received.map((e) => e.id), emitted.map((e) => e.id));
});

test("replays nothing after the last id but still delivers live events", () => {
  const hub = new RuntimeEventHub();
  const emitted = emitThree(hub);

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true, emitted[2].id);
  assert.equal(received.length, 0);

  const live = hub.emit({ kind: "agent-message", sessionId: "s1", text: "four" });
  assert.deepEqual(received.map((e) => e.id), [live.id]);
});
