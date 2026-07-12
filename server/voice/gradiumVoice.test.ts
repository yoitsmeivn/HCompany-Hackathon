import assert from "node:assert/strict";
import test from "node:test";
import { GradiumStreamingTranscriber, GradiumStreamingTts } from "./gradiumVoice.js";
import { parseGradiumSttMessage } from "./gradiumMessages.js";
import type { FinalTranscript, WebSocketFactory, WebSocketLike } from "./types.js";

test("Gradium STT sends telephony setup and forwards Twilio base64 unchanged", () => {
  const socket = new FakeWebSocket();
  const transcripts: FinalTranscript[] = [];
  const errors: Error[] = [];
  const transcriber = new GradiumStreamingTranscriber(sttConfig(), factory(socket));
  const session = transcriber.open({ callSid: "CA1", streamSid: "MZ1", onTranscript: (value) => { transcripts.push(value); }, onError: (error) => { errors.push(error); } });
  socket.open();
  assert.deepEqual(socket.json[0], { type: "setup", model_name: "default", input_format: "ulaw_8000", json_config: { language: "en", delay_in_frames: 16 }, close_ws_on_eos: true });
  session.appendMulaw("AQIDBA==");
  assert.deepEqual(socket.json[1], { type: "audio", audio: "AQIDBA==" });
  socket.message({ type: "ready", request_id: "req-1", model_name: "default", sample_rate: 8000, frame_size: 640, delay_in_frames: 16, text_stream_names: [] });
  assert.equal(errors.length, 0);
  assert.equal(transcripts.length, 0);
});

test("end_text plus semantic VAD flush emits exactly one finalized turn", async () => {
  const socket = new FakeWebSocket();
  const transcripts: FinalTranscript[] = [];
  const transcriber = new GradiumStreamingTranscriber(sttConfig(), factory(socket));
  transcriber.open({ callSid: "CA1", streamSid: "MZ1", onTranscript: (value) => { transcripts.push(value); }, onError: assert.fail });
  socket.open();
  socket.message({ type: "text", text: "Find the report", start_s: 0.1, stream_id: 0 });
  socket.message({ type: "end_text", stop_s: 1.2, stream_id: 0 });
  for (let step = 1; step <= 3; step += 1) socket.message(vadStep(step, 0.8));
  assert.deepEqual(socket.json.at(-1), { type: "flush", flush_id: 1 });
  socket.message({ type: "flushed", flush_id: 1 });
  socket.message({ type: "flushed", flush_id: 1 });
  await Promise.resolve();
  assert.deepEqual(transcripts, [{ turnId: "gradium-MZ1-1", text: "Find the report" }]);
});

test("duplicate high VAD events do not issue duplicate pending flushes", () => {
  const socket = new FakeWebSocket();
  const transcriber = new GradiumStreamingTranscriber(sttConfig(), factory(socket));
  transcriber.open({ callSid: "CA1", streamSid: "MZ1", onTranscript: () => {}, onError: assert.fail });
  socket.open();
  socket.message({ type: "text", text: "Hello", start_s: 0, stream_id: 0 });
  for (let step = 1; step <= 8; step += 1) socket.message(vadStep(step, 0.9));
  assert.equal(socket.json.filter((message) => message.type === "flush").length, 1);
});

test("malformed Gradium messages fail and cleanup STT", () => {
  const socket = new FakeWebSocket();
  const errors: Error[] = [];
  const transcriber = new GradiumStreamingTranscriber(sttConfig(), factory(socket));
  transcriber.open({ callSid: "CA1", streamSid: "MZ1", onTranscript: () => {}, onError: (error) => errors.push(error) });
  socket.open();
  socket.raw("{bad json");
  assert.match(errors[0]?.message ?? "", /malformed/);
  assert.equal(socket.closeCount, 1);
});

test("Gradium protocol parser rejects unknown message fields", () => {
  assert.throws(() => parseGradiumSttMessage(JSON.stringify({ type: "ready", request_id: "req", secret: "no" })));
});

test("Gradium TTS sends setup, text, EOS and yields unchanged ulaw payload", async () => {
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1" }, factory(socket));
  const chunks = tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  assert.deepEqual(socket.json[0], { type: "setup", model_name: "default", voice_id: "voice-1", output_format: "ulaw_8000", close_ws_on_eos: true });
  socket.message({ type: "ready", request_id: "req-tts", model_name: "default", sample_rate: 8000 });
  assert.deepEqual(socket.json.slice(1), [{ type: "text", text: "Hello caller" }, { type: "end_of_stream" }]);
  socket.message({ type: "audio", audio: "qrvM", start_s: 0, stop_s: 0.1, stream_id: 0 });
  socket.message({ type: "end_of_stream" });
  assert.deepEqual(await collect(chunks), ["qrvM"]);
});

test("aborting Gradium TTS prevents stale chunks", async () => {
  const socket = new FakeWebSocket();
  const controller = new AbortController();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1" }, factory(socket));
  const chunks = tts.synthesize({ text: "Interrupted", callSid: "CA1", streamSid: "MZ1", signal: controller.signal });
  socket.open();
  socket.message({ type: "ready", request_id: "req-tts" });
  controller.abort();
  socket.message({ type: "audio", audio: "AAAA" });
  assert.deepEqual(await collect(chunks), []);
  assert.equal(socket.closeCount, 1);
});

function sttConfig() {
  return { apiKey: "test-key", model: "default", language: "en", delayInFrames: 16, vadHorizonSeconds: 2, vadInactivityThreshold: 0.5, vadConsecutiveSteps: 3 };
}
function vadStep(step: number, inactivity: number) {
  return { type: "step", vad: [{ horizon_s: 0.5, inactivity_prob: 0.1 }, { horizon_s: 1, inactivity_prob: 0.2 }, { horizon_s: 2, inactivity_prob: inactivity }], step_idx: step, step_duration_s: 0.08, total_duration_s: step * 0.08 };
}
function factory(socket: FakeWebSocket): WebSocketFactory { return () => socket; }
async function collect(iterable: AsyncIterable<string>): Promise<string[]> { const values: string[] = []; for await (const value of iterable) values.push(value); return values; }

class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  sent: string[] = [];
  closeCount = 0;
  private listeners = new Map<string, Array<(...args: never[]) => void>>();
  get json(): Array<Record<string, unknown>> { return this.sent.map((value) => JSON.parse(value) as Record<string, unknown>); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.closeCount += 1; this.readyState = 3; this.emit("close"); }
  on(event: string, listener: (...args: never[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  open(): void { this.readyState = 1; this.emit("open"); }
  message(value: object): void { this.raw(JSON.stringify(value)); }
  raw(value: string): void { this.emit("message", { toString: () => value }); }
  private emit(event: string, ...args: unknown[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args as never[]); }
}
