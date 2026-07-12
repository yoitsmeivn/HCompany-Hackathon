import assert from "node:assert/strict";
import test from "node:test";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { VoiceRuntime, type VoiceOutput } from "./voiceRuntime.js";
import type { FinalTranscript, SpeechActivityEvent, SpeechRecognizer, SpeechSynthesizer, TranscriptionSession } from "./types.js";

test("finalized Gradium transcript reaches the existing orchestrator with demo-computer", () => {
  const recognizer = new FakeRecognizer();
  const sessions = new FakeSessions();
  const runtime = new VoiceRuntime(recognizer, new ImmediateSynthesizer(), sessions as unknown as SessionOrchestrationService, new RuntimeEventHub(), (id) => id === "demo-computer");
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  recognizer.transcript({ turnId: "turn-1", text: "Find my report" });
  assert.deepEqual(sessions.inputs, [{ sessionId: "session-1", computerId: "demo-computer", text: "Find my report", allowedFolders: [], allowedApplications: [] }]);
});

test("missing internal computer is rejected before orchestration", () => {
  const recognizer = new FakeRecognizer();
  const sessions = new FakeSessions();
  const errors: Error[] = [];
  const runtime = new VoiceRuntime(recognizer, new ImmediateSynthesizer(), sessions as unknown as SessionOrchestrationService, new RuntimeEventHub(), () => false);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "missing" }, new FakeOutput(), (error) => errors.push(error));
  recognizer.transcript({ turnId: "turn-1", text: "Hello" });
  assert.match(errors[0]?.message ?? "", /not registered/);
  assert.equal(sessions.inputs.length, 0);
});

test("Gradium audio chunks pass through and Twilio mark follows completion", async () => {
  const events = new RuntimeEventHub();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  events.emit({ kind: "agent-message", sessionId: "session-1", text: "Ready" });
  await settle();
  assert.deepEqual(output.operations, ["audio:qrvM", "audio:3q2+", "mark"]);
});

test("speech activity aborts active TTS and clears Twilio buffered audio", async () => {
  const events = new RuntimeEventHub();
  const recognizer = new FakeRecognizer();
  const synthesizer = new ControlledSynthesizer();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(recognizer, synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  events.emit({ kind: "agent-message", sessionId: "session-1", text: "Long response" });
  await settle();
  assert.deepEqual(output.operations, ["audio:first"]);
  recognizer.activity({ type: "speech-start" });
  synthesizer.release();
  await settle();
  assert.deepEqual(output.operations, ["audio:first", "clear"]);
});

test("emits call-started and call-ended monitor events around a call", () => {
  const events = new RuntimeEventHub();
  const kinds: string[] = [];
  events.subscribeMonitor(({ event }) => kinds.push(event.kind));
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer", from: "+16505550000" }, new FakeOutput(), assert.fail);
  call.close();
  assert.deepEqual(kinds, ["call-started", "call-ended"]);
});

test("applies the owner's folder and application access from policy", () => {
  const recognizer = new FakeRecognizer();
  const sessions = new FakeSessions();
  const runtime = new VoiceRuntime(
    recognizer, new ImmediateSynthesizer(), sessions as unknown as SessionOrchestrationService, new RuntimeEventHub(),
    () => true,
    () => ({ ownerName: "Ada", authorizedPhone: "", allowedFolders: ["Documents"], allowedApplications: ["Finder"] }),
  );
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer", from: "+16505550000" }, new FakeOutput(), assert.fail);
  recognizer.transcript({ turnId: "turn-1", text: "Find my report" });
  assert.deepEqual(sessions.inputs, [{ sessionId: "session-1", computerId: "demo-computer", text: "Find my report", allowedFolders: ["Documents"], allowedApplications: ["Finder"] }]);
});

test("rejects a call from an unauthorized number without orchestrating", () => {
  const events = new RuntimeEventHub();
  const messages: string[] = [];
  events.subscribe("session-1", ({ event }) => { if (event.kind === "agent-message") messages.push(event.text); });
  const recognizer = new FakeRecognizer();
  const sessions = new FakeSessions();
  const runtime = new VoiceRuntime(
    recognizer, new ImmediateSynthesizer(), sessions as unknown as SessionOrchestrationService, events,
    () => true,
    () => ({ ownerName: "Ada", authorizedPhone: "+16505550000", allowedFolders: [], allowedApplications: [] }),
  );
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer", from: "+19998887777" }, new FakeOutput(), assert.fail);
  recognizer.transcript({ turnId: "turn-1", text: "Do something" });
  assert.equal(sessions.inputs.length, 0);
  assert.match(messages[0] ?? "", /not authorized/i);
});

test("authorizes a matching caller regardless of phone formatting", () => {
  const recognizer = new FakeRecognizer();
  const sessions = new FakeSessions();
  const runtime = new VoiceRuntime(
    recognizer, new ImmediateSynthesizer(), sessions as unknown as SessionOrchestrationService, new RuntimeEventHub(),
    () => true,
    () => ({ ownerName: "Ada", authorizedPhone: "+1 (650) 555-0000", allowedFolders: [], allowedApplications: [] }),
  );
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer", from: "6505550000" }, new FakeOutput(), assert.fail);
  recognizer.transcript({ turnId: "turn-1", text: "Find my report" });
  assert.equal(sessions.inputs.length, 1);
});

class FakeRecognizer implements SpeechRecognizer {
  private onTranscript: ((transcript: FinalTranscript) => void | Promise<void>) | null = null;
  private onActivity: ((event: SpeechActivityEvent) => void) | undefined;
  open(input: Parameters<SpeechRecognizer["open"]>[0]): TranscriptionSession {
    this.onTranscript = input.onTranscript;
    this.onActivity = input.onSpeechActivity;
    return { appendMulaw() {}, close() {} };
  }
  transcript(value: FinalTranscript): void { void this.onTranscript?.(value); }
  activity(value: SpeechActivityEvent): void { this.onActivity?.(value); }
}

class ImmediateSynthesizer implements SpeechSynthesizer {
  async *synthesize(): AsyncIterable<string> { yield "qrvM"; yield "3q2+"; }
}

class ControlledSynthesizer implements SpeechSynthesizer {
  private resolve: (() => void) | null = null;
  async *synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    yield "first";
    await new Promise<void>((resolve) => { this.resolve = resolve; });
    if (!input.signal?.aborted) yield "stale";
  }
  release(): void { this.resolve?.(); }
}

class FakeSessions {
  inputs: unknown[] = [];
  enqueue(input: unknown): void { this.inputs.push(input); }
}

class FakeOutput implements VoiceOutput {
  operations: string[] = [];
  audio(value: string): void { this.operations.push(`audio:${value}`); }
  mark(): void { this.operations.push("mark"); }
  clear(): void { this.operations.push("clear"); }
}

async function settle(): Promise<void> { await new Promise((resolve) => setTimeout(resolve, 0)); }
