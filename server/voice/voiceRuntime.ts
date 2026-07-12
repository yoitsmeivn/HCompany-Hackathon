import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import type { SpeechRecognizer, SpeechSynthesizer, TranscriptionSession } from "./types.js";

export interface VoiceCallContext {
  callSid: string;
  streamSid: string;
  sessionId: string;
  computerId: string;
}

export interface VoiceOutput {
  audio(base64Mulaw: string): void;
  mark(): void;
  clear(): void;
}

export interface VoiceCall {
  inboundAudio(base64Mulaw: string): void;
  close(): void;
}

export class VoiceRuntime {
  constructor(
    private readonly recognizer: SpeechRecognizer,
    private readonly synthesizer: SpeechSynthesizer,
    private readonly sessions: SessionOrchestrationService,
    private readonly events: RuntimeEventHub,
    private readonly computerExists: (computerId: string) => boolean = () => true,
  ) {}

  open(context: VoiceCallContext, output: VoiceOutput, onError: (error: Error) => void): VoiceCall {
    let closed = false;
    let activeTtsAbortController: AbortController | null = null;
    let outputQueue = Promise.resolve();
    const unsubscribe = this.events.subscribe(context.sessionId, ({ event }) => {
      if (closed || event.kind !== "agent-message") return;
      outputQueue = outputQueue.then(async () => {
        if (closed) return;
        const controller = new AbortController();
        activeTtsAbortController = controller;
        try {
          for await (const audio of this.synthesizer.synthesize({ text: event.text, callSid: context.callSid, streamSid: context.streamSid, signal: controller.signal })) {
            if (closed || controller.signal.aborted) break;
            output.audio(audio);
          }
          if (!closed && !controller.signal.aborted) output.mark();
        } finally {
          if (activeTtsAbortController === controller) activeTtsAbortController = null;
        }
      }).catch(onError);
    }, false);
    const transcription: TranscriptionSession = this.recognizer.open({
      callSid: context.callSid,
      streamSid: context.streamSid,
      onTranscript: ({ text }) => {
        if (closed) return;
        if (!this.computerExists(context.computerId)) {
          onError(new Error(`Kylian computer ${context.computerId} is not registered`));
          return;
        }
        this.events.emit({ kind: "user-message", sessionId: context.sessionId, text, who: "Caller" });
        this.sessions.enqueue({ sessionId: context.sessionId, computerId: context.computerId, text, allowedFolders: [], allowedApplications: [] });
      },
      onSpeechActivity: ({ type }) => {
        if (type !== "speech-start" || !activeTtsAbortController) return;
        activeTtsAbortController.abort();
        output.clear();
      },
      onError,
    });
    return {
      inboundAudio(audio) { if (!closed) transcription.appendMulaw(audio); },
      close() {
        if (closed) return;
        closed = true;
        activeTtsAbortController?.abort();
        activeTtsAbortController = null;
        transcription.close();
        unsubscribe();
      },
    };
  }
}
