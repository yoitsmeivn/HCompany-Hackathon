export interface FinalTranscript {
  turnId: string;
  text: string;
}

export interface SpeechActivityEvent {
  type: "speech-start" | "turn-boundary";
}

export interface TranscriptionSession {
  appendMulaw(base64Audio: string): void;
  close(): void;
}

export interface SpeechRecognizer {
  open(input: {
    callSid: string;
    streamSid: string;
    onTranscript: (transcript: FinalTranscript) => void | Promise<void>;
    onSpeechActivity?: (event: SpeechActivityEvent) => void;
    onError: (error: Error) => void;
  }): TranscriptionSession;
}

export interface SpeechSynthesizer {
  synthesize(input: {
    text: string;
    callSid: string;
    streamSid: string;
    signal?: AbortSignal;
  }): AsyncIterable<string>;
  // Optional per-call connection lifecycle (used by session-reusing synthesizers).
  prewarm?(streamSid: string): void;
  release?(streamSid: string): void;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "open", listener: () => void): this;
  on(event: "message", listener: (data: { toString(): string }) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: () => void): this;
}

export type WebSocketFactory = (url: string, options: { headers: Record<string, string> }) => WebSocketLike;
