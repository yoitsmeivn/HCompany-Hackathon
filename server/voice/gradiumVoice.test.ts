import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config.js";
import { GradiumStreamingTranscriber, GradiumStreamingTts } from "./gradiumVoice.js";
import { parseGradiumSttMessage, parseGradiumTtsMessage } from "./gradiumMessages.js";
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
  assert.match(errors[0]?.message ?? "", /must be valid JSON/);
  assert.equal(socket.closeCount, 1);
});

test("Gradium protocol parser tolerates additive fields but rejects unknown message types", () => {
  assert.equal(parseGradiumSttMessage(JSON.stringify({ type: "ready", request_id: "req", extra_meta: "ok" })).type, "ready");
  assert.throws(() => parseGradiumSttMessage(JSON.stringify({ type: "telemetry" })), /Gradium STT unsupported message type: telemetry/);
  assert.throws(() => parseGradiumSttMessage(JSON.stringify({ nonsense: true })), /unsupported message type: <missing>/);
});

test("Gradium TTS parser matches the live wire protocol shapes", () => {
  assert.equal(parseGradiumTtsMessage(JSON.stringify({ type: "ready", client_req_id: null, request_id: "req-1", model_name: "default", model_ext: "tts-live", sample_rate: 8000, frame_size: 640, audio_stream_names: ["audio_0"], text_stream_names: ["text_0"] })).type, "ready");
  assert.equal(parseGradiumTtsMessage(JSON.stringify({ type: "ready", request_id: "req-1", client_req_id: "session-42" })).type, "ready");
  const audio = parseGradiumTtsMessage(JSON.stringify({ type: "audio", client_req_id: null, audio: "qrvM", start_s: 0, stop_s: 0.08, stream_id: 0, audio_tokens: [[1, 2, 3]] }));
  assert.deepEqual({ type: audio.type, payload: audio.type === "audio" ? audio.audio : null }, { type: "audio", payload: "qrvM" });
  assert.equal(parseGradiumTtsMessage(JSON.stringify({ type: "text", client_req_id: null, text: "Hi.", start_s: 0, stop_s: 0.4, stream_id: 0 })).type, "text");
  assert.equal(parseGradiumTtsMessage(JSON.stringify({ type: "end_of_stream", client_req_id: null })).type, "end_of_stream");
  assert.equal(parseGradiumTtsMessage(JSON.stringify({ type: "error", message: "backend busy", code: 429, client_req_id: null })).type, "error");
});

test("Gradium TTS parser rejects unknown types and invalid audio with key-only diagnostics", () => {
  assert.throws(() => parseGradiumTtsMessage(JSON.stringify({ type: "telemetry", detail: "x" })), /Gradium TTS unsupported message type: telemetry/);
  assert.throws(() => parseGradiumTtsMessage(JSON.stringify({ type: "audio", client_req_id: null, audio: "not base64!" })), /Gradium TTS audio message failed validation; keys=audio,client_req_id,type/);
  assert.throws(() => parseGradiumTtsMessage("{bad json"), /Gradium TTS message must be valid JSON/);
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

test("Gradium TTS streams audio for the exact live protocol shapes", async () => {
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1" }, factory(socket));
  const chunks = tts.synthesize({ text: "Hi, this is Kylian.", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  socket.message({ type: "ready", client_req_id: null, request_id: "req-live", model_name: "default", model_ext: "tts-live", sample_rate: 8000, frame_size: 640, audio_stream_names: ["audio_0"], text_stream_names: ["text_0"] });
  assert.deepEqual(socket.json.slice(1), [{ type: "text", text: "Hi, this is Kylian." }, { type: "end_of_stream" }]);
  socket.message({ type: "audio", client_req_id: null, audio: "qrvM", start_s: 0, stop_s: 0.08, stream_id: 0, audio_tokens: [[1, 2, 3]] });
  socket.message({ type: "audio", client_req_id: null, audio: "3q2+", start_s: 0.08, stop_s: 0.16, stream_id: 0, audio_tokens: [[4]] });
  socket.message({ type: "text", client_req_id: null, text: "Hi, this is Kylian.", start_s: 0, stop_s: 1.2, stream_id: 0 });
  socket.message({ type: "end_of_stream", client_req_id: null });
  assert.deepEqual(await collect(chunks), ["qrvM", "3q2+"]);
});

test("unsupported Gradium TTS message fails once with a key-only log and no secrets", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { logged.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" ")); });
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1" }, factory(socket));
  const chunks = tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  socket.message({ type: "telemetry", payload: "ignored" });
  socket.message({ type: "telemetry", payload: "ignored again" });
  await assert.rejects(collect(chunks), /Gradium TTS unsupported message type: telemetry/);
  assert.equal(socket.closeCount, 1);
  const joined = logged.join("\n");
  assert.match(joined, /gradium tts message rejected/);
  assert.doesNotMatch(joined, /test-key|ignored/);
});

test("Gradium TTS provider error fails the stream with sanitized logs and no API key", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { logged.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" ")); });
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1" }, factory(socket));
  const chunks = tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  socket.message({ type: "ready", request_id: "req-tts" });
  socket.message({ type: "error", message: "voice backend unavailable for +14155551234", code: 500 });
  await assert.rejects(collect(chunks), /Gradium TTS error 500/);
  assert.equal(socket.closeCount, 1);
  const joined = logged.join("\n");
  assert.match(joined, /gradium tts error/);
  assert.doesNotMatch(joined, /test-key/);
  assert.doesNotMatch(joined, /\+14155551234/);
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

test("faster end-of-turn defaults propagate from config into the Gradium STT setup", () => {
  const config = loadConfig({});
  assert.deepEqual(
    { delay: config.gradiumSttDelayInFrames, horizon: config.gradiumVadHorizonSeconds, threshold: config.gradiumVadInactivityThreshold, steps: config.gradiumVadConsecutiveSteps },
    { delay: 8, horizon: 1, threshold: 0.5, steps: 2 },
  );
  const socket = new FakeWebSocket();
  const transcriber = new GradiumStreamingTranscriber({
    apiKey: "test-key",
    model: config.gradiumSttModel,
    language: config.gradiumSttLanguage,
    delayInFrames: config.gradiumSttDelayInFrames,
    vadHorizonSeconds: config.gradiumVadHorizonSeconds,
    vadInactivityThreshold: config.gradiumVadInactivityThreshold,
    vadConsecutiveSteps: config.gradiumVadConsecutiveSteps,
  }, factory(socket));
  transcriber.open({ callSid: "CA1", streamSid: "MZ-vad", onTranscript: () => {}, onError: assert.fail });
  socket.open();
  assert.deepEqual(socket.json[0].json_config, { language: "en", delay_in_frames: 8 });
});

test("Gradium TTS voice settings default and parse from the environment", () => {
  const defaults = loadConfig({});
  assert.deepEqual(
    { speed: defaults.gradiumTtsSpeed, temperature: defaults.gradiumTtsTemperature, similarity: defaults.gradiumTtsVoiceSimilarity, rewrite: defaults.gradiumTtsRewriteRules, pronunciation: defaults.gradiumTtsPronunciationId },
    { speed: -1.0, temperature: 0.5, similarity: 2.0, rewrite: undefined, pronunciation: undefined },
  );
  const blank = loadConfig({ GRADIUM_TTS_SPEED: "", GRADIUM_TTS_TEMPERATURE: " ", GRADIUM_TTS_VOICE_SIMILARITY: "", GRADIUM_TTS_REWRITE_RULES: "", GRADIUM_TTS_PRONUNCIATION_ID: " " });
  assert.deepEqual(
    { speed: blank.gradiumTtsSpeed, temperature: blank.gradiumTtsTemperature, similarity: blank.gradiumTtsVoiceSimilarity, rewrite: blank.gradiumTtsRewriteRules, pronunciation: blank.gradiumTtsPronunciationId },
    { speed: -1.0, temperature: 0.5, similarity: 2.0, rewrite: undefined, pronunciation: undefined },
  );
  const custom = loadConfig({ GRADIUM_TTS_SPEED: "-2.5", GRADIUM_TTS_TEMPERATURE: "0.9", GRADIUM_TTS_VOICE_SIMILARITY: "3.5", GRADIUM_TTS_REWRITE_RULES: "en", GRADIUM_TTS_PRONUNCIATION_ID: "dict-1" });
  assert.deepEqual(
    { speed: custom.gradiumTtsSpeed, temperature: custom.gradiumTtsTemperature, similarity: custom.gradiumTtsVoiceSimilarity, rewrite: custom.gradiumTtsRewriteRules, pronunciation: custom.gradiumTtsPronunciationId },
    { speed: -2.5, temperature: 0.9, similarity: 3.5, rewrite: "en", pronunciation: "dict-1" },
  );
});

test("invalid or out-of-range Gradium TTS voice settings fail startup with the variable name", () => {
  assert.throws(() => loadConfig({ GRADIUM_TTS_SPEED: "abc" }), /GRADIUM_TTS_SPEED/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_SPEED: "-5" }), /GRADIUM_TTS_SPEED/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_SPEED: "4.1" }), /GRADIUM_TTS_SPEED/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_TEMPERATURE: "2" }), /GRADIUM_TTS_TEMPERATURE/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_TEMPERATURE: "-0.1" }), /GRADIUM_TTS_TEMPERATURE/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_VOICE_SIMILARITY: "0.5" }), /GRADIUM_TTS_VOICE_SIMILARITY/);
  assert.throws(() => loadConfig({ GRADIUM_TTS_VOICE_SIMILARITY: "4.5" }), /GRADIUM_TTS_VOICE_SIMILARITY/);
});

test("Gradium TTS setup frame carries voice settings in json_config and top-level pronunciation_id", async () => {
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts(
    { apiKey: "test-key", model: "default", voiceId: "voice-1", speed: -1.0, temperature: 0.5, voiceSimilarity: 2.0, rewriteRules: "en", pronunciationId: "dict-1" },
    factory(socket),
  );
  const chunks = tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  assert.deepEqual(socket.json[0], {
    type: "setup",
    model_name: "default",
    voice_id: "voice-1",
    output_format: "ulaw_8000",
    close_ws_on_eos: true,
    json_config: { padding_bonus: -1.0, temp: 0.5, cfg_coef: 2.0, rewrite_rules: "en" },
    pronunciation_id: "dict-1",
  });
  socket.message({ type: "ready", request_id: "req-tts", client_req_id: null });
  socket.message({ type: "audio", audio: "qrvM", client_req_id: null, audio_tokens: [[1]] });
  socket.message({ type: "end_of_stream", client_req_id: null });
  assert.deepEqual(await collect(chunks), ["qrvM"]);
});

test("blank rewrite rules and pronunciation ID are omitted from the setup frame", () => {
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts({ apiKey: "test-key", model: "default", voiceId: "voice-1", speed: -1.0, temperature: 0.5, voiceSimilarity: 2.0 }, factory(socket));
  void tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  assert.deepEqual(socket.json[0], {
    type: "setup",
    model_name: "default",
    voice_id: "voice-1",
    output_format: "ulaw_8000",
    close_ws_on_eos: true,
    json_config: { padding_bonus: -1.0, temp: 0.5, cfg_coef: 2.0 },
  });
});

test("voice settings never leak the voice ID or values into logs", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { logged.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" ")); });
  const socket = new FakeWebSocket();
  const tts = new GradiumStreamingTts(
    { apiKey: "test-key", model: "default", voiceId: "voice-secret-8sWS", speed: -1.0, temperature: 0.5, voiceSimilarity: 2.0, pronunciationId: "dict-secret" },
    factory(socket),
  );
  void tts.synthesize({ text: "Hello caller", callSid: "CA1", streamSid: "MZ1" });
  socket.open();
  const joined = logged.join("\n");
  assert.match(joined, /gradium tts connection opened/);
  assert.match(joined, /"customVoiceSettings":true/);
  assert.doesNotMatch(joined, /voice-secret-8sWS|dict-secret|test-key|padding_bonus|-1/);
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
