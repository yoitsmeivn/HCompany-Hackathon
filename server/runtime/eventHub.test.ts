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

test("screen-frame envelopes are kept out of the replay history", () => {
  const hub = new RuntimeEventHub();
  emitThree(hub);
  for (let seq = 1; seq <= 3; seq += 1) {
    hub.emit({ kind: "screen-frame", sessionId: "s1", mediaType: "image/jpeg", dataBase64: `frame-${seq}`, seq });
  }

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true);

  const frames = received.filter((e) => e.event.kind === "screen-frame");
  // Only the newest frame is replayed — not a history of every screenshot.
  assert.equal(frames.length, 1);
  assert.equal(frames[0].event.kind === "screen-frame" && frames[0].event.dataBase64, "frame-3");
  // The three agent-messages still replay in full.
  assert.equal(received.filter((e) => e.event.kind === "agent-message").length, 3);
});

test("replays the latest frame after buffered events on subscribe", () => {
  const hub = new RuntimeEventHub();
  hub.emit({ kind: "agent-message", sessionId: "s1", text: "hi" });
  hub.emit({ kind: "screen-frame", sessionId: "s1", mediaType: "image/jpeg", dataBase64: "latest", seq: 1 });

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true);

  assert.deepEqual(received.map((e) => e.event.kind), ["agent-message", "screen-frame"]);
});

test("does not replay any frame when none was emitted", () => {
  const hub = new RuntimeEventHub();
  hub.emit({ kind: "agent-message", sessionId: "s1", text: "hi" });

  const received: RuntimeEventEnvelope[] = [];
  hub.subscribe("s1", (envelope) => received.push(envelope), true);

  assert.ok(!received.some((e) => e.event.kind === "screen-frame"));
});
