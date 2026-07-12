import assert from "node:assert/strict";
import test from "node:test";
import { makeTranscriptGate } from "./openaiVoice.js";

test("suppresses an identical transcript repeated within the window", () => {
  const gate = makeTranscriptGate(2000);
  assert.equal(gate("send my resume", 1000), true, "first final is emitted");
  assert.equal(gate("send my resume", 1500), false, "the duplicate final is dropped");
  assert.equal(gate("send my resume", 3600), true, "a later repeat past the window is a new turn");
});

test("distinct transcripts always pass", () => {
  const gate = makeTranscriptGate(2000);
  assert.equal(gate("hello", 1000), true);
  assert.equal(gate("via whatsapp", 1100), true, "a different utterance is not deduped");
});
