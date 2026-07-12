export interface SpeechToTextPort {
  pushAudio(streamId: string, audio: Uint8Array): Promise<void>;
  close(streamId: string): Promise<void>;
}

export interface TextToSpeechPort {
  synthesize(streamId: string, text: string): AsyncIterable<Uint8Array>;
}

export interface MessagingChannelPort {
  readonly channel: "whatsapp" | "web";
  send(recipientId: string, text: string): Promise<void>;
}

export interface LiveViewPort {
  createSession(sessionId: string): Promise<{ roomId: string; participantToken: string }>;
  closeSession(sessionId: string): Promise<void>;
}

// Future implementations: Gradium STT/TTS and LiveKit/WebRTC. The
// NemoClaw/WhatsApp ingress adapter lives in ./nemoclawChannel.ts. These
// contracts deliberately contain no provider claims.
