import OpenAI from "openai";
import WebSocket from "ws";
import { pcm24kToMulaw8k } from "./audio.js";
import type { SpeechRecognizer, SpeechSynthesizer, TranscriptionSession } from "./types.js";

/**
 * Suppresses a duplicate final transcript (same text re-emitted within a short
 * window) so one utterance can't launch two orchestration turns. The Gradium
 * recognizer dedups on stable turn ids; the OpenAI realtime stream has no such
 * id, so we dedup on the text itself.
 */
export function makeTranscriptGate(windowMs = 2000): (text: string, now: number) => boolean {
  let lastText = "";
  let lastAt = 0;
  return (text, now) => {
    if (text === lastText && now - lastAt < windowMs) return false;
    lastText = text;
    lastAt = now;
    return true;
  };
}

export class OpenAIRealtimeTranscriber implements SpeechRecognizer {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  open(input: Parameters<SpeechRecognizer["open"]>[0]): TranscriptionSession {
    const socket = new WebSocket("wss://api.openai.com/v1/realtime?intent=transcription", { headers: { Authorization: `Bearer ${this.apiKey}` } });
    const pending: string[] = [];
    const gate = makeTranscriptGate();
    socket.on("open", () => {
      socket.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "transcription",
          audio: { input: { format: { type: "audio/pcmu" }, transcription: { model: this.model }, turn_detection: { type: "server_vad" } } },
        },
      }));
      for (const audio of pending.splice(0)) sendAudio(socket, audio);
    });
    socket.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString()) as { type?: string; transcript?: string; error?: { message?: string } };
        if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
          const text = event.transcript.trim();
          if (gate(text, Date.now())) void input.onTranscript({ turnId: `openai-${input.streamSid}-${Date.now()}`, text });
        }
        if (event.type === "error") input.onError(new Error(event.error?.message ?? "OpenAI transcription error"));
      } catch { input.onError(new Error("OpenAI returned an invalid transcription event")); }
    });
    socket.on("error", (error) => input.onError(error));
    return {
      appendMulaw(audio) { if (socket.readyState === WebSocket.OPEN) sendAudio(socket, audio); else if (socket.readyState === WebSocket.CONNECTING) pending.push(audio); },
      close() { pending.length = 0; if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(1000); },
    };
  }
}

export class OpenAISpeechSynthesizer implements SpeechSynthesizer {
  constructor(private readonly client: OpenAI, private readonly model: string, private readonly voice: string) {}
  async *synthesize(input: Parameters<SpeechSynthesizer["synthesize"]>[0]): AsyncIterable<string> {
    if (input.signal?.aborted) return;
    const response = await this.client.audio.speech.create({ model: this.model, voice: this.voice, input: input.text, response_format: "pcm" });
    if (input.signal?.aborted) return;
    yield Buffer.from(pcm24kToMulaw8k(new Uint8Array(await response.arrayBuffer()))).toString("base64");
  }
}

function sendAudio(socket: WebSocket, audio: string): void {
  socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
}
