import { AsyncQueue } from "./asyncQueue.js";
import { buildTtsSetup, defaultWebSocketFactory, type GradiumTtsConfig } from "./gradiumVoice.js";
import { parseGradiumTtsMessage } from "./gradiumMessages.js";
import type { SpeechSynthesizer, WebSocketFactory, WebSocketLike } from "./types.js";
import { logVoice, sanitizeProviderError } from "./voiceLog.js";
import { turnMetrics } from "./turnMetrics.js";

const TTS_URL = "wss://api.gradium.ai/api/speech/tts";
const OPEN = 1;
const CONNECTING = 0;

interface ActiveRequest {
  reqId: string;
  text: string;
  queue: AsyncQueue<string>;
  requestedAt: number;
  gotAudio: boolean;
}

interface CallEntry {
  streamSid: string;
  socket: WebSocketLike;
  active: ActiveRequest | null;
  closed: boolean;
}

// One Gradium TTS WebSocket per Twilio call, reused across utterances via the
// documented multiplexing protocol: per-request setup with close_ws_on_eos:false
// and a unique client_req_id; the server tags every reply with that id.
// Gradium has no cancel message, so barge-in closes the socket and the next
// utterance reconnects once.
export class GradiumTtsSession implements SpeechSynthesizer {
  private readonly calls = new Map<string, CallEntry>();
  // Session-global so request ids never collide across barge-in reconnects.
  private requestCounter = 0;

  constructor(private readonly config: GradiumTtsConfig, private readonly sockets: WebSocketFactory = defaultWebSocketFactory) {}

  prewarm(streamSid: string): void {
    this.ensureEntry(streamSid);
  }

  release(streamSid: string): void {
    const entry = this.calls.get(streamSid);
    if (!entry) return;
    this.dropEntry(entry);
  }

  synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    const queue = new AsyncQueue<string>();
    const existing = this.calls.get(input.streamSid);
    const reused = Boolean(existing && !existing.closed);
    const entry = this.ensureEntry(input.streamSid);
    const reqId = `req-${++this.requestCounter}`;
    entry.active = { reqId, text: input.text, queue, requestedAt: Date.now(), gotAudio: false };
    logVoice("gradium tts reused", { streamSid: input.streamSid, reused });
    logVoice("synthesis queued", { streamSid: input.streamSid, callSid: input.callSid, reqId });
    const abort = () => {
      const active = entry.active;
      if (!active || active.reqId !== reqId) return;
      entry.active = null;
      queue.end();
      this.dropEntry(entry);
    };
    input.signal?.addEventListener("abort", abort, { once: true });
    if (entry.socket.readyState === OPEN) this.startRequest(entry);
    return queue;
  }

  private ensureEntry(streamSid: string): CallEntry {
    const existing = this.calls.get(streamSid);
    if (existing && !existing.closed) return existing;
    logVoice("gradium tts connecting", { streamSid });
    const socket = this.sockets(TTS_URL, { headers: { "x-api-key": this.config.apiKey } });
    const entry: CallEntry = { streamSid, socket, active: null, closed: false };
    this.calls.set(streamSid, entry);
    socket.on("open", () => {
      if (entry.closed) return;
      logVoice("gradium tts connection opened", { streamSid, reused: false });
      if (entry.active) this.startRequest(entry);
    });
    socket.on("message", (data) => this.handleMessage(entry, data.toString()));
    socket.on("error", (error) => {
      logVoice("gradium tts socket error", { streamSid, error: sanitizeProviderError(error) });
      entry.active?.queue.fail(error instanceof Error ? error : new Error("Gradium TTS socket error"));
      entry.active = null;
      this.dropEntry(entry);
    });
    socket.on("close", () => {
      if (entry.closed) return;
      if (entry.active) {
        logVoice("gradium tts closed unexpectedly", { streamSid });
        entry.active.queue.end();
        entry.active = null;
      }
      entry.closed = true;
      if (this.calls.get(streamSid) === entry) this.calls.delete(streamSid);
    });
    return entry;
  }

  private startRequest(entry: CallEntry): void {
    const active = entry.active;
    if (!active) return;
    entry.socket.send(JSON.stringify(buildTtsSetup(this.config, { close_ws_on_eos: false, client_req_id: active.reqId })));
  }

  private handleMessage(entry: CallEntry, raw: string): void {
    const active = entry.active;
    let message;
    try { message = parseGradiumTtsMessage(raw); }
    catch (error) {
      const parseError = error instanceof Error ? error : new Error("Gradium TTS returned a malformed message");
      logVoice("gradium tts message rejected", { streamSid: entry.streamSid, error: sanitizeProviderError(parseError) });
      active?.queue.fail(parseError);
      entry.active = null;
      this.dropEntry(entry);
      return;
    }
    if (!active) return;
    if (message.type !== "ready" && "client_req_id" in message && message.client_req_id && message.client_req_id !== active.reqId) return;
    if (message.type === "ready") {
      if (message.client_req_id && message.client_req_id !== active.reqId) return;
      logVoice("gradium tts ready", { streamSid: entry.streamSid, reqId: active.reqId });
      turnMetrics.mark(entry.streamSid, "tts-ready");
      entry.socket.send(JSON.stringify({ type: "text", text: active.text, client_req_id: active.reqId }));
      entry.socket.send(JSON.stringify({ type: "end_of_stream", client_req_id: active.reqId }));
      return;
    }
    if (message.type === "audio") {
      if (!active.gotAudio) {
        active.gotAudio = true;
        logVoice("gradium tts first audio", { streamSid: entry.streamSid, reqId: active.reqId, latency_ms: Date.now() - active.requestedAt });
      }
      active.queue.push(message.audio);
      return;
    }
    if (message.type === "end_of_stream") {
      active.queue.end();
      entry.active = null;
      return;
    }
    if (message.type === "error") {
      logVoice("gradium tts error", { streamSid: entry.streamSid, error: sanitizeProviderError(new Error(message.message)) });
      active.queue.fail(new Error(`Gradium TTS error${message.code ? ` ${message.code}` : ""}: ${message.message}`));
      entry.active = null;
      return;
    }
  }

  private dropEntry(entry: CallEntry): void {
    if (entry.closed) return;
    entry.closed = true;
    if (this.calls.get(entry.streamSid) === entry) this.calls.delete(entry.streamSid);
    if (entry.socket.readyState === OPEN || entry.socket.readyState === CONNECTING) entry.socket.close(1000);
  }
}
