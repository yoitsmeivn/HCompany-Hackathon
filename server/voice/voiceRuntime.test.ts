import assert from "node:assert/strict";
import test from "node:test";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { DEFAULT_VOICE_GREETING, VoiceRuntime, type VoiceOutput } from "./voiceRuntime.js";
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

test("opening a call speaks the greeting exactly once through the configured synthesizer", async () => {
  const synthesizer = new RecordingSynthesizer();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  assert.deepEqual(synthesizer.texts, [DEFAULT_VOICE_GREETING]);
  assert.deepEqual(output.operations, ["audio:qrvM", "audio:3q2+", "mark:greeting-complete:CA1"]);
  await settle();
  assert.deepEqual(synthesizer.texts, [DEFAULT_VOICE_GREETING]);
});

test("greeting audio waits for synthesizer readiness before any Twilio media", async () => {
  const synthesizer = new GatedSynthesizer();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  assert.deepEqual(output.operations, []);
  synthesizer.release();
  await settle();
  assert.deepEqual(output.operations, ["audio:qrvM", "mark:greeting-complete:CA1"]);
});

test("agent messages are spoken after the greeting and pass Gradium chunks through", async () => {
  const events = new RuntimeEventHub();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  events.emit({ kind: "agent-message", sessionId: "session-1", text: "Ready" });
  await settle();
  assert.deepEqual(output.operations, ["audio:qrvM", "audio:3q2+", "mark:greeting-complete:CA1", "audio:qrvM", "audio:3q2+", "mark"]);
});

test("agent-speech phrases are spoken and already-spoken agent-messages are not repeated", async () => {
  const events = new RuntimeEventHub();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  const afterGreeting = output.operations.length;
  events.emit({ kind: "agent-speech", sessionId: "session-1", text: "Found it." });
  events.emit({ kind: "agent-speech", sessionId: "session-1", text: "It is in Documents." });
  events.emit({ kind: "agent-message", sessionId: "session-1", text: "Found it. It is in Documents.", spoken: true });
  await settle();
  const utterances = output.operations.slice(afterGreeting).filter((op) => op === "mark").length;
  assert.equal(utterances, 2, "two agent-speech phrases spoken; the spoken agent-message is skipped");
});

test("plain agent-messages without the spoken flag are still spoken (mock orchestrator path)", async () => {
  const events = new RuntimeEventHub();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  const afterGreeting = output.operations.length;
  events.emit({ kind: "agent-message", sessionId: "session-1", text: "Mock reply" });
  await settle();
  assert.deepEqual(output.operations.slice(afterGreeting), ["audio:qrvM", "audio:3q2+", "mark"]);
});

test("opening a call prewarms the synthesizer session and closing releases it", async () => {
  const synthesizer = new LifecycleSynthesizer();
  const runtime = new VoiceRuntime(new FakeRecognizer(), synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ-life", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  assert.deepEqual(synthesizer.prewarmed, ["MZ-life"]);
  await settle();
  call.close();
  assert.deepEqual(synthesizer.released, ["MZ-life"]);
});

test("speech activity aborts active agent TTS and clears Twilio buffered audio after the greeting", async () => {
  const events = new RuntimeEventHub();
  const recognizer = new FakeRecognizer();
  const synthesizer = new GreetingThenControlledSynthesizer();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(recognizer, synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, events);
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  call.markAcknowledged?.("greeting-complete:CA1");
  events.emit({ kind: "agent-speech", sessionId: "session-1", text: "Long response" });
  await settle();
  assert.deepEqual(output.operations.at(-1), "audio:first");
  recognizer.activity({ type: "speech-start" });
  synthesizer.release();
  await settle();
  assert.deepEqual(output.operations.slice(-2), ["audio:first", "clear"]);
  assert.ok(!output.operations.includes("audio:stale"), "aborted synthesis yields no stale audio");
});

test("caller audio during the greeting is ignored and STT receives nothing", async () => {
  const recognizer = new FakeRecognizer();
  const runtime = new VoiceRuntime(recognizer, new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  call.inboundAudio("AQIDBA==");
  await settle();
  call.inboundAudio("AQIDBA==");
  assert.deepEqual(recognizer.inbound, [], "no STT forwarding before the greeting mark is acknowledged");
});

test("the greeting mark acknowledgement enables listening and caller audio then flows", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { logged.push(String(args[0])); });
  const recognizer = new FakeRecognizer();
  const runtime = new VoiceRuntime(recognizer, new ImmediateSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  await settle();
  call.markAcknowledged?.("some-other-mark");
  call.inboundAudio("AQIDBA==");
  assert.deepEqual(recognizer.inbound, [], "unrelated marks do not enable listening");
  call.markAcknowledged?.("greeting-complete:CA1");
  call.inboundAudio("AQIDBA==");
  assert.deepEqual(recognizer.inbound, ["AQIDBA=="]);
  assert.ok(logged.includes("[voice] greeting started"));
  assert.ok(logged.includes("[voice] greeting audio completed"));
  assert.ok(logged.includes("[voice] greeting mark sent"));
  assert.ok(logged.includes("[voice] greeting mark acknowledged"));
  assert.ok(logged.includes("[voice] listening enabled"));
});

test("the fallback timeout enables listening without replaying the greeting", async () => {
  const recognizer = new FakeRecognizer();
  const synthesizer = new RecordingSynthesizer();
  const runtime = new VoiceRuntime(recognizer, synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub(), () => true, undefined, DEFAULT_VOICE_GREETING, 5);
  const call = runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 15));
  call.inboundAudio("AQIDBA==");
  assert.deepEqual(recognizer.inbound, ["AQIDBA=="], "listening enabled by timeout");
  assert.deepEqual(synthesizer.texts, [DEFAULT_VOICE_GREETING], "the greeting is never replayed");
});

test("speech-start during the greeting does not barge in", async () => {
  const recognizer = new FakeRecognizer();
  const synthesizer = new ControlledSynthesizer();
  const output = new FakeOutput();
  const runtime = new VoiceRuntime(recognizer, synthesizer, new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, output, assert.fail);
  await settle();
  assert.deepEqual(output.operations, ["audio:first"], "greeting is mid-playback");
  recognizer.activity({ type: "speech-start" });
  assert.ok(!output.operations.includes("clear"), "no barge-in clear during the greeting");
  synthesizer.release();
  await settle();
  assert.deepEqual(output.operations.at(-1), "mark:greeting-complete:CA1", "greeting completes normally");
});

test("the greeting is never fed back into conversation events", async () => {
  const events = new RuntimeEventHub();
  const emitted: string[] = [];
  events.subscribe("session-1", ({ event }) => { emitted.push(event.kind); });
  const runtime = new VoiceRuntime(new FakeRecognizer(), new RecordingSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, events);
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), assert.fail);
  await settle();
  assert.deepEqual(emitted, [], "greeting produces no agent-speech, agent-message, or user-message events");
});

test("greeting synthesis failure is logged sanitized and reported without crashing", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { logged.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" ")); });
  const errors: Error[] = [];
  const runtime = new VoiceRuntime(new FakeRecognizer(), new ThrowingSynthesizer(), new FakeSessions() as unknown as SessionOrchestrationService, new RuntimeEventHub());
  runtime.open({ callSid: "CA1", streamSid: "MZ1", sessionId: "session-1", computerId: "demo-computer" }, new FakeOutput(), (error) => errors.push(error));
  await settle();
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /unavailable/);
  const joined = logged.join("\n");
  assert.match(joined, /greeting synthesis failed/);
  assert.doesNotMatch(joined, /\+14155551234/);
  assert.doesNotMatch(joined, /gsk_|sk-proj|qrvM/);
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
  inbound: string[] = [];
  private onTranscript: ((transcript: FinalTranscript) => void | Promise<void>) | null = null;
  private onActivity: ((event: SpeechActivityEvent) => void) | undefined;
  open(input: Parameters<SpeechRecognizer["open"]>[0]): TranscriptionSession {
    this.onTranscript = input.onTranscript;
    this.onActivity = input.onSpeechActivity;
    return { appendMulaw: (audio) => { this.inbound.push(audio); }, close() {} };
  }
  transcript(value: FinalTranscript): void { void this.onTranscript?.(value); }
  activity(value: SpeechActivityEvent): void { this.onActivity?.(value); }
}

class ImmediateSynthesizer implements SpeechSynthesizer {
  async *synthesize(): AsyncIterable<string> { yield "qrvM"; yield "3q2+"; }
}

class LifecycleSynthesizer implements SpeechSynthesizer {
  prewarmed: string[] = [];
  released: string[] = [];
  async *synthesize(): AsyncIterable<string> { yield "qrvM"; }
  prewarm(streamSid: string): void { this.prewarmed.push(streamSid); }
  release(streamSid: string): void { this.released.push(streamSid); }
}

class RecordingSynthesizer implements SpeechSynthesizer {
  texts: string[] = [];
  async *synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    this.texts.push(input.text);
    yield "qrvM";
    yield "3q2+";
  }
}

class GatedSynthesizer implements SpeechSynthesizer {
  private resolve: (() => void) | null = null;
  private readonly gate = new Promise<void>((resolve) => { this.resolve = resolve; });
  async *synthesize(): AsyncIterable<string> {
    await this.gate;
    yield "qrvM";
  }
  release(): void { this.resolve?.(); }
}

class GreetingThenControlledSynthesizer implements SpeechSynthesizer {
  private resolve: (() => void) | null = null;
  private calls = 0;
  async *synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    this.calls += 1;
    if (this.calls === 1) { yield "greet"; return; }
    yield "first";
    await new Promise<void>((resolve) => { this.resolve = resolve; });
    if (!input.signal?.aborted) yield "stale";
  }
  release(): void { this.resolve?.(); }
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

class ThrowingSynthesizer implements SpeechSynthesizer {
  // eslint-disable-next-line require-yield
  async *synthesize(): AsyncIterable<string> {
    throw new Error("Gradium TTS unavailable for +14155551234");
  }
}

class FakeSessions {
  inputs: unknown[] = [];
  enqueue(input: unknown): void { this.inputs.push(input); }
}

class FakeOutput implements VoiceOutput {
  operations: string[] = [];
  audio(value: string): void { this.operations.push(`audio:${value}`); }
  mark(name?: string): void { this.operations.push(name ? `mark:${name}` : "mark"); }
  clear(): void { this.operations.push("clear"); }
}

async function settle(): Promise<void> { await new Promise((resolve) => setTimeout(resolve, 0)); }
