import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config.js";
import type { VoiceRuntime } from "../voice/voiceRuntime.js";
import { TwilioMediaStreamConnection, type TwilioSocket } from "./mediaStreamConnection.js";
import { frameOutboundAudio, parseTwilioMediaMessage } from "./mediaMessages.js";

const startMessage = {
  event: "start", sequenceNumber: "1", streamSid: "MZ123",
  start: {
    streamSid: "MZ123", accountSid: "AC123", callSid: "CA123", tracks: ["inbound"],
    customParameters: { sessionId: "session-1", computerId: "computer-1" },
    mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
  },
};

test("parses valid connected, start, media, mark, and stop messages", () => {
  assert.equal(parseTwilioMediaMessage(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" })).event, "connected");
  assert.equal(parseTwilioMediaMessage(JSON.stringify(startMessage)).event, "start");
  assert.equal(parseTwilioMediaMessage(JSON.stringify({ event: "media", sequenceNumber: "2", streamSid: "MZ123", media: { track: "inbound", chunk: "1", timestamp: "20", payload: "AA==" } })).event, "media");
  assert.equal(parseTwilioMediaMessage(JSON.stringify({ event: "mark", sequenceNumber: "3", streamSid: "MZ123", mark: { name: "played" } })).event, "mark");
  assert.equal(parseTwilioMediaMessage(JSON.stringify({ event: "stop", sequenceNumber: "4", streamSid: "MZ123", stop: { accountSid: "AC123", callSid: "CA123" } })).event, "stop");
});

test("rejects malformed and extra WebSocket fields", () => {
  assert.throws(() => parseTwilioMediaMessage("not-json"));
  assert.throws(() => parseTwilioMediaMessage(JSON.stringify({ ...startMessage, unexpected: true })));
  assert.throws(() => parseTwilioMediaMessage(JSON.stringify({ event: "media", sequenceNumber: "2", streamSid: "MZ123", media: { track: "inbound", chunk: "1", timestamp: "20", payload: "not base64!" } })));
});

test("tracks lifecycle, forwards inbound audio, and cleans up on stop", () => {
  const socket = new FakeSocket();
  const voice = new FakeVoice();
  const connection = new TwilioMediaStreamConnection(socket, voice as unknown as VoiceRuntime, "fallback");
  connection.handleRaw(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
  connection.handleRaw(JSON.stringify(startMessage));
  connection.handleRaw(JSON.stringify({ event: "media", sequenceNumber: "2", streamSid: "MZ123", media: { track: "inbound", chunk: "1", timestamp: "20", payload: "AA==" } }));
  connection.handleRaw(JSON.stringify({ event: "stop", sequenceNumber: "3", streamSid: "MZ123", stop: { accountSid: "AC123", callSid: "CA123" } }));
  assert.deepEqual({ callSid: connection.state.callSid, streamSid: connection.state.streamSid, sessionId: connection.state.sessionId, lifecycle: connection.state.lifecycle }, { callSid: "CA123", streamSid: "MZ123", sessionId: "session-1", lifecycle: "stopped" });
  assert.deepEqual(voice.audio, ["AA=="]);
  assert.equal(voice.closed, 1);
});

test("closes malformed connections without logging payloads", () => {
  const socket = new FakeSocket();
  const connection = new TwilioMediaStreamConnection(socket, new FakeVoice() as unknown as VoiceRuntime, "fallback");
  connection.handleRaw("not-json");
  assert.deepEqual(socket.closed, { code: 1008, reason: "Invalid Twilio media message" });
  assert.equal(connection.state.lifecycle, "failed");
});

test("requires media stream configuration when Twilio is enabled", () => {
  assert.throws(() => loadConfig({ TWILIO_AUTH_TOKEN: "secret" }), /TWILIO_MEDIA_STREAM_URL/);
  assert.throws(() => loadConfig({ TWILIO_MEDIA_STREAM_URL: "ws://example.test/twilio/media-stream" }), /public wss/);
});

test("explicit Gradium mode requires key and voice", () => {
  const base = {
    OPENAI_API_KEY: "openai-test",
    TWILIO_AUTH_TOKEN: "twilio-test",
    TWILIO_MEDIA_STREAM_URL: "wss://example.test/twilio/media-stream",
    KYLIAN_VOICE_COMPUTER_ID: "demo-computer",
    KYLIAN_VOICE_PROVIDER: "gradium",
  };
  assert.throws(() => loadConfig(base), /GRADIUM_API_KEY/);
  assert.throws(() => loadConfig({ ...base, GRADIUM_API_KEY: "gradium-test" }), /GRADIUM_TTS_VOICE/);
});

test("explicit Gradium selection fails without required settings even before Twilio setup", () => {
  assert.throws(() => loadConfig({ KYLIAN_VOICE_PROVIDER: "gradium" }), /GRADIUM_API_KEY/);
});

test("frames outbound mulaw audio as media followed by mark", () => {
  const [media, mark] = frameOutboundAudio("MZ123", Uint8Array.from([0, 127, 255]));
  assert.deepEqual(media, { event: "media", streamSid: "MZ123", media: { payload: "AH//" } });
  assert.equal(mark.event, "mark");
  assert.equal(mark.streamSid, "MZ123");
});

class FakeSocket implements TwilioSocket {
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  send(data: string): void { this.sent.push(data); }
  close(code?: number, reason?: string): void { this.closed = { code, reason }; }
}

class FakeVoice {
  audio: string[] = [];
  closed = 0;
  open() {
    return { inboundAudio: (audio: string) => this.audio.push(audio), close: () => { this.closed += 1; } };
  }
}
