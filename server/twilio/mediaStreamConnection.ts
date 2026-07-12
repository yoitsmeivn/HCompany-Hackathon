import type WebSocket from "ws";
import type { VoiceCall, VoiceRuntime } from "../voice/voiceRuntime.js";
import { logVoice } from "../voice/voiceLog.js";
import { frameOutboundClear, frameOutboundMark, frameOutboundPayload, parseTwilioMediaMessage, type TwilioMediaInbound } from "./mediaMessages.js";

export type StreamLifecycle = "awaiting-connected" | "awaiting-start" | "streaming" | "stopped" | "failed";

export interface MediaStreamState {
  callSid: string | null;
  streamSid: string | null;
  sessionId: string | null;
  lifecycle: StreamLifecycle;
}

export interface TwilioSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export class TwilioMediaStreamConnection {
  readonly state: MediaStreamState = { callSid: null, streamSid: null, sessionId: null, lifecycle: "awaiting-connected" };
  private call: VoiceCall | null = null;
  private readonly pendingMarks = new Set<string>();
  private sentFirstMediaFrame = false;

  constructor(private readonly socket: TwilioSocket, private readonly voice: VoiceRuntime, private readonly defaultComputerId: string) {}

  handleRaw(raw: string): void {
    try { this.handle(parseTwilioMediaMessage(raw)); }
    catch { this.fail(1008, "Invalid Twilio media message"); }
  }

  handle(message: TwilioMediaInbound): void {
    if (message.event === "connected") {
      if (this.state.lifecycle !== "awaiting-connected") return this.fail(1008, "Unexpected connected event");
      logVoice("twilio connected event");
      this.state.lifecycle = "awaiting-start";
      return;
    }
    if (message.event === "start") {
      if (this.state.lifecycle === "streaming") {
        logVoice("duplicate twilio start event ignored", { callSid: this.state.callSid ?? undefined, streamSid: this.state.streamSid ?? undefined });
        return;
      }
      if (this.state.lifecycle !== "awaiting-start") return this.fail(1008, "Unexpected start event");
      const sessionId = message.start.customParameters.sessionId || message.start.callSid;
      const computerId = message.start.customParameters.computerId || this.defaultComputerId;
      const from = message.start.customParameters.from || undefined;
      if (!computerId) return this.fail(1008, "Missing computer ID");
      this.state.callSid = message.start.callSid;
      this.state.streamSid = message.streamSid;
      this.state.sessionId = sessionId;
      this.state.lifecycle = "streaming";
      logVoice("twilio start event", { callSid: message.start.callSid, streamSid: message.streamSid, sessionId, computerId });
      this.call = this.voice.open(
        { callSid: message.start.callSid, streamSid: message.streamSid, sessionId, computerId, from },
        { audio: (payload) => this.sendAudio(payload), mark: (name) => this.sendMark(name), clear: () => this.clearAudio() },
        () => this.fail(1011, "Voice runtime failed"),
      );
      return;
    }
    if (message.event === "media") {
      if (!this.matchesActiveStream(message.streamSid) || message.media.track !== "inbound") return this.fail(1008, "Invalid media stream state");
      this.call?.inboundAudio(message.media.payload);
      return;
    }
    if (message.event === "mark") {
      if (!this.matchesActiveStream(message.streamSid)) return this.fail(1008, "Invalid mark stream state");
      this.pendingMarks.delete(message.mark.name);
      this.call?.markAcknowledged?.(message.mark.name);
      return;
    }
    if (message.event === "stop") {
      if (!this.matchesActiveStream(message.streamSid) || message.stop.callSid !== this.state.callSid) return this.fail(1008, "Invalid stop stream state");
      logVoice("twilio stop event", { callSid: this.state.callSid ?? undefined, streamSid: this.state.streamSid ?? undefined });
      this.cleanup("stopped");
    }
  }

  disconnected(code?: number, reason?: string): void {
    logVoice("twilio socket closed", { callSid: this.state.callSid ?? undefined, streamSid: this.state.streamSid ?? undefined, code, reason, lifecycle: this.state.lifecycle });
    this.cleanup(this.state.lifecycle === "failed" ? "failed" : "stopped");
  }

  private sendAudio(payload: string): void {
    if (!this.state.streamSid || this.state.lifecycle !== "streaming") return;
    if (!this.sentFirstMediaFrame) {
      this.sentFirstMediaFrame = true;
      logVoice("first twilio media frame sent", { callSid: this.state.callSid ?? undefined, streamSid: this.state.streamSid });
    }
    this.socket.send(JSON.stringify(frameOutboundPayload(this.state.streamSid, payload)));
  }

  private sendMark(name?: string): void {
    if (!this.state.streamSid || this.state.lifecycle !== "streaming") return;
    const mark = frameOutboundMark(this.state.streamSid, name);
    if (mark.event !== "mark") return;
    this.pendingMarks.add(mark.mark.name);
    this.socket.send(JSON.stringify(mark));
  }

  private clearAudio(): void {
    if (!this.state.streamSid || this.state.lifecycle !== "streaming") return;
    this.pendingMarks.clear();
    this.socket.send(JSON.stringify(frameOutboundClear(this.state.streamSid)));
  }

  private matchesActiveStream(streamSid: string): boolean { return this.state.lifecycle === "streaming" && streamSid === this.state.streamSid; }

  private fail(code: number, reason: string): void {
    logVoice("twilio stream failed", { callSid: this.state.callSid ?? undefined, streamSid: this.state.streamSid ?? undefined, code, reason });
    this.cleanup("failed");
    this.socket.close(code, reason);
  }

  private cleanup(lifecycle: "stopped" | "failed"): void {
    this.call?.close();
    this.call = null;
    this.pendingMarks.clear();
    this.state.lifecycle = lifecycle;
  }
}

export function attachConnection(socket: WebSocket, voice: VoiceRuntime, defaultComputerId: string): TwilioMediaStreamConnection {
  const connection = new TwilioMediaStreamConnection(socket, voice, defaultComputerId);
  socket.on("message", (data, isBinary) => { if (isBinary) socket.close(1003, "Text messages required"); else connection.handleRaw(data.toString()); });
  socket.on("close", (code, reason) => connection.disconnected(code, reason.toString()));
  socket.on("error", (error) => connection.disconnected(undefined, error.message));
  return connection;
}
