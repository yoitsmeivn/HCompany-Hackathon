import WebSocket from "ws";
import { AsyncQueue } from "./asyncQueue.js";
import { parseGradiumSttMessage, parseGradiumTtsMessage, type GradiumSttMessage } from "./gradiumMessages.js";
import type { SpeechRecognizer, SpeechSynthesizer, TranscriptionSession, WebSocketFactory, WebSocketLike } from "./types.js";
import { logVoice, sanitizeProviderError } from "./voiceLog.js";
import { turnMetrics } from "./turnMetrics.js";

const STT_URL = "wss://api.gradium.ai/api/speech/asr";
const TTS_URL = "wss://api.gradium.ai/api/speech/tts";
const OPEN = WebSocket.OPEN;
const CONNECTING = WebSocket.CONNECTING;

export interface GradiumSttConfig {
  apiKey: string;
  model: string;
  language: string;
  delayInFrames: number;
  vadHorizonSeconds: number;
  vadInactivityThreshold: number;
  vadConsecutiveSteps: number;
}

export interface GradiumTtsConfig {
  apiKey: string;
  model: string;
  voiceId: string;
  speed?: number;
  temperature?: number;
  voiceSimilarity?: number;
  rewriteRules?: string;
  pronunciationId?: string;
}

export const defaultWebSocketFactory: WebSocketFactory = (url, options) => new WebSocket(url, options);

export class GradiumStreamingTranscriber implements SpeechRecognizer {
  constructor(private readonly config: GradiumSttConfig, private readonly sockets: WebSocketFactory = defaultWebSocketFactory) {}

  open(input: Parameters<SpeechRecognizer["open"]>[0]): TranscriptionSession {
    const socket = this.sockets(STT_URL, { headers: { "x-api-key": this.config.apiKey } });
    const pendingAudio: string[] = [];
    const liveSegments = new Map<number, string>();
    const finalizedSegments: string[] = [];
    const handledTurns = new Set<string>();
    let consecutiveHighVad = 0;
    let flushId = 0;
    let pendingFlushId: number | null = null;
    let closed = false;
    let speechActive = false;

    socket.on("open", () => {
      send(socket, { type: "setup", model_name: this.config.model, input_format: "ulaw_8000", json_config: { language: this.config.language, delay_in_frames: this.config.delayInFrames }, close_ws_on_eos: true });
      for (const audio of pendingAudio.splice(0)) send(socket, { type: "audio", audio });
    });
    socket.on("message", (data) => {
      if (closed) return;
      let message: GradiumSttMessage;
      try { message = parseGradiumSttMessage(data.toString()); }
      catch (error) { return fail(error instanceof Error ? error : new Error("Gradium STT returned a malformed message")); }
      if (message.type === "ready") return;
      if (message.type === "text") {
        const id = message.stream_id ?? 0;
        liveSegments.set(id, [liveSegments.get(id), message.text].filter(Boolean).join(" ").trim());
        return;
      }
      if (message.type === "end_text") {
        const id = message.stream_id ?? 0;
        const segment = liveSegments.get(id)?.trim();
        if (segment) finalizedSegments.push(segment);
        liveSegments.delete(id);
        return;
      }
      if (message.type === "step") {
        const prediction = closestHorizon(message.vad, this.config.vadHorizonSeconds);
        if (!prediction) return;
        const high = prediction.inactivity_prob > this.config.vadInactivityThreshold;
        if (high && consecutiveHighVad === 0 && hasTranscript(liveSegments, finalizedSegments)) turnMetrics.mark(input.streamSid, "speech-end-candidate");
        consecutiveHighVad = high ? consecutiveHighVad + 1 : 0;
        if (!high && !speechActive) { speechActive = true; input.onSpeechActivity?.({ type: "speech-start" }); }
        if (high) speechActive = false;
        if (pendingFlushId === null && consecutiveHighVad >= this.config.vadConsecutiveSteps && hasTranscript(liveSegments, finalizedSegments)) {
          pendingFlushId = ++flushId;
          consecutiveHighVad = 0;
          input.onSpeechActivity?.({ type: "turn-boundary" });
          turnMetrics.mark(input.streamSid, "stt-flush-requested");
          send(socket, { type: "flush", flush_id: pendingFlushId });
        }
        return;
      }
      if (message.type === "flushed") {
        if (message.flush_id !== pendingFlushId) return;
        turnMetrics.mark(input.streamSid, "stt-flushed");
        for (const segment of liveSegments.values()) if (segment.trim()) finalizedSegments.push(segment.trim());
        liveSegments.clear();
        const turnId = `gradium-${input.streamSid}-${message.flush_id}`;
        const transcript = finalizedSegments.join(" ").replace(/\s+/g, " ").trim();
        finalizedSegments.length = 0;
        pendingFlushId = null;
        if (transcript && !handledTurns.has(turnId)) {
          handledTurns.add(turnId);
          void Promise.resolve(input.onTranscript({ turnId, text: transcript })).catch(input.onError);
        }
        return;
      }
      if (message.type === "error") {
        logVoice("gradium stt error", { callSid: input.callSid, streamSid: input.streamSid, error: sanitizeProviderError(new Error(message.message)) });
        return fail(new Error(`Gradium STT error${message.code ? ` ${message.code}` : ""}: ${message.message}`));
      }
      if (message.type === "end_of_stream") { closed = true; closeSocket(socket); }
    });
    socket.on("error", (error) => {
      logVoice("gradium stt socket error", { callSid: input.callSid, streamSid: input.streamSid, error: sanitizeProviderError(error) });
      fail(error);
    });
    socket.on("close", () => { closed = true; pendingAudio.length = 0; });

    const fail = (error: Error) => {
      if (closed) return;
      closed = true;
      pendingAudio.length = 0;
      input.onError(error);
      closeSocket(socket, 1011);
    };
    return {
      appendMulaw(audio) {
        if (closed) return;
        if (socket.readyState === OPEN) send(socket, { type: "audio", audio });
        else if (socket.readyState === CONNECTING) pendingAudio.push(audio);
      },
      close() {
        if (closed) return;
        closed = true;
        pendingAudio.length = 0;
        if (socket.readyState === OPEN) send(socket, { type: "end_of_stream" });
        closeSocket(socket);
      },
    };
  }
}

export class GradiumStreamingTts implements SpeechSynthesizer {
  constructor(private readonly config: GradiumTtsConfig, private readonly sockets: WebSocketFactory = defaultWebSocketFactory) {}

  synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    const queue = new AsyncQueue<string>();
    const socket = this.sockets(TTS_URL, { headers: { "x-api-key": this.config.apiKey } });
    let closed = false;
    const abort = () => { if (closed) return; closed = true; queue.end(); closeSocket(socket, 1000); };
    input.signal?.addEventListener("abort", abort, { once: true });
    socket.on("open", () => {
      if (input.signal?.aborted) return abort();
      const setup = this.buildSetup();
      logVoice("gradium tts connection opened", { callSid: input.callSid, streamSid: input.streamSid, customVoiceSettings: "json_config" in setup || "pronunciation_id" in setup });
      send(socket, setup);
    });
    socket.on("message", (data) => {
      if (closed) return;
      try {
        const message = parseGradiumTtsMessage(data.toString());
        if (message.type === "ready") {
          send(socket, { type: "text", text: input.text });
          send(socket, { type: "end_of_stream" });
        } else if (message.type === "audio") queue.push(message.audio);
        else if (message.type === "end_of_stream") { closed = true; queue.end(); closeSocket(socket); }
        else if (message.type === "error") {
          closed = true;
          logVoice("gradium tts error", { callSid: input.callSid, streamSid: input.streamSid, error: sanitizeProviderError(new Error(message.message)) });
          queue.fail(new Error(`Gradium TTS error${message.code ? ` ${message.code}` : ""}: ${message.message}`));
          closeSocket(socket, 1011);
        }
      } catch (error) {
        closed = true;
        const parseError = error instanceof Error ? error : new Error("Gradium TTS returned a malformed message");
        logVoice("gradium tts message rejected", { callSid: input.callSid, streamSid: input.streamSid, error: sanitizeProviderError(parseError) });
        queue.fail(parseError);
        closeSocket(socket, 1011);
      }
    });
    socket.on("error", (error) => {
      logVoice("gradium tts socket error", { callSid: input.callSid, streamSid: input.streamSid, error: sanitizeProviderError(error) });
      if (!closed) { closed = true; queue.fail(error); }
    });
    socket.on("close", () => {
      if (!closed) {
        logVoice("gradium tts closed unexpectedly", { callSid: input.callSid, streamSid: input.streamSid });
        closed = true;
        queue.end();
      }
      input.signal?.removeEventListener("abort", abort);
    });
    return queue;
  }

  private buildSetup(): Record<string, unknown> {
    return buildTtsSetup(this.config, { close_ws_on_eos: true });
  }
}

// output_format must stay ulaw_8000: Twilio media streams consume the chunks as-is.
export function buildTtsSetup(config: GradiumTtsConfig, overrides: Record<string, unknown>): Record<string, unknown> {
  const jsonConfig: Record<string, number | string> = {};
  if (config.speed !== undefined) jsonConfig.padding_bonus = config.speed;
  if (config.temperature !== undefined) jsonConfig.temp = config.temperature;
  if (config.voiceSimilarity !== undefined) jsonConfig.cfg_coef = config.voiceSimilarity;
  if (config.rewriteRules) jsonConfig.rewrite_rules = config.rewriteRules;
  const setup: Record<string, unknown> = { type: "setup", model_name: config.model, voice_id: config.voiceId, output_format: "ulaw_8000", ...overrides };
  if (Object.keys(jsonConfig).length > 0) setup.json_config = jsonConfig;
  if (config.pronunciationId) setup.pronunciation_id = config.pronunciationId;
  return setup;
}

function closestHorizon(vad: Array<{ horizon_s: number; inactivity_prob: number }>, target: number) {
  return vad.reduce<(typeof vad)[number] | undefined>((best, item) => !best || Math.abs(item.horizon_s - target) < Math.abs(best.horizon_s - target) ? item : best, undefined);
}
function hasTranscript(live: Map<number, string>, finalized: string[]): boolean { return finalized.length > 0 || [...live.values()].some((text) => text.trim()); }
function send(socket: WebSocketLike, message: object): void { socket.send(JSON.stringify(message)); }
function closeSocket(socket: WebSocketLike, code = 1000): void { if (socket.readyState === OPEN || socket.readyState === CONNECTING) socket.close(code); }
