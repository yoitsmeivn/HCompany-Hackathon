import assert from "node:assert/strict";
import test from "node:test";
import { TurnMetrics } from "./turnMetrics.js";

test("a full turn logs every latency stage as sanitized integers", (t) => {
  const logged: Array<Record<string, unknown>> = [];
  t.mock.method(console, "log", (...args: unknown[]) => { if (args[0] === "[voice] turn latency") logged.push(args[1] as Record<string, unknown>); });
  let now = 0;
  const metrics = new TurnMetrics(() => now);
  metrics.alias("MZ1", "session-1");
  metrics.mark("MZ1", "speech-end-candidate");
  now = 120; metrics.mark("MZ1", "stt-flush-requested");
  now = 300; metrics.mark("session-1", "transcript-final");
  now = 310; metrics.mark("session-1", "openai-start");
  now = 700; metrics.mark("session-1", "openai-first-text");
  now = 800; metrics.mark("session-1", "tool-start");
  now = 900; metrics.mark("session-1", "tool-complete");
  now = 1000; metrics.mark("session-1", "openai-complete");
  now = 1010; metrics.mark("session-1", "tts-requested");
  now = 1200; metrics.mark("MZ1", "tts-ready");
  now = 1300; metrics.mark("session-1", "tts-first-audio");
  now = 1305; metrics.mark("session-1", "twilio-first-frame");
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], {
    sessionId: "session-1",
    vad_ms: 120,
    stt_finalize_ms: 180,
    openai_first_text_ms: 390,
    openai_total_ms: 690,
    tool_ms: 100,
    tts_ready_ms: 190,
    tts_first_audio_ms: 290,
    total_turn_ms: 1305,
  });
  for (const [key, value] of Object.entries(logged[0])) {
    if (key === "sessionId") continue;
    assert.equal(Number.isInteger(value), true, `${key} must be an integer`);
  }
});

test("missing stages log as undefined and marks without a turn are ignored", (t) => {
  const logged: Array<Record<string, unknown>> = [];
  t.mock.method(console, "log", (...args: unknown[]) => { if (args[0] === "[voice] turn latency") logged.push(args[1] as Record<string, unknown>); });
  let now = 0;
  const metrics = new TurnMetrics(() => now);
  metrics.mark("session-2", "tts-requested");
  metrics.mark("session-2", "twilio-first-frame");
  assert.equal(logged.length, 0, "no turn without a speech-end candidate");
  metrics.mark("session-2", "speech-end-candidate");
  now = 500; metrics.mark("session-2", "twilio-first-frame");
  assert.equal(logged.length, 1);
  assert.equal(logged[0].total_turn_ms, 500);
  assert.equal(logged[0].tool_ms, undefined);
  assert.equal(logged[0].openai_first_text_ms, undefined);
});

test("a new speech-end candidate resets a stale turn and unalias clears state", (t) => {
  const logged: Array<Record<string, unknown>> = [];
  t.mock.method(console, "log", (...args: unknown[]) => { if (args[0] === "[voice] turn latency") logged.push(args[1] as Record<string, unknown>); });
  let now = 0;
  const metrics = new TurnMetrics(() => now);
  metrics.mark("session-3", "speech-end-candidate");
  now = 5_000;
  metrics.mark("session-3", "speech-end-candidate");
  now = 5_200; metrics.mark("session-3", "twilio-first-frame");
  assert.equal(logged[0].total_turn_ms, 200, "stale turn was replaced by the new one");
  metrics.alias("MZ9", "session-9");
  metrics.mark("MZ9", "speech-end-candidate");
  metrics.unalias("MZ9");
  metrics.mark("session-9", "twilio-first-frame");
  assert.equal(logged.length, 1, "unalias dropped the pending turn");
});
