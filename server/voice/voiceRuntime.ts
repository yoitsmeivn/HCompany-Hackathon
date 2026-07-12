import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { phoneMatches, type ComputerPolicy } from "../runtime/policyStore.js";
import type { SpeechRecognizer, SpeechSynthesizer, TranscriptionSession } from "./types.js";
import { logVoice, sanitizeProviderError } from "./voiceLog.js";
import { turnMetrics } from "./turnMetrics.js";

export const DEFAULT_VOICE_GREETING = "Hi, I’m Kylian. I’m here to help you access and work with your computer remotely. What can I help you with today?";
export const GREETING_MARK_TIMEOUT_MS = 15_000;

export type CallPhase = "starting" | "greeting" | "listening" | "thinking" | "speaking" | "closing";

export interface VoiceCallContext {
  callSid: string;
  streamSid: string;
  sessionId: string;
  computerId: string;
  from?: string;
}

export interface VoiceOutput {
  audio(base64Mulaw: string): void;
  mark(name?: string): void;
  clear(): void;
}

export interface VoiceCall {
  inboundAudio(base64Mulaw: string): void;
  markAcknowledged?(name: string): void;
  close(): void;
}

export class VoiceRuntime {
  constructor(
    private readonly recognizer: SpeechRecognizer,
    private readonly synthesizer: SpeechSynthesizer,
    private readonly sessions: SessionOrchestrationService,
    private readonly events: RuntimeEventHub,
    private readonly computerExists: (computerId: string) => boolean = () => true,
    private readonly policyFor: (computerId: string) => ComputerPolicy | undefined = () => undefined,
    private readonly greeting: string = DEFAULT_VOICE_GREETING,
    private readonly greetingMarkTimeoutMs: number = GREETING_MARK_TIMEOUT_MS,
  ) {}

  open(context: VoiceCallContext, output: VoiceOutput, onError: (error: Error) => void): VoiceCall {
    let closed = false;
    let phase: CallPhase = "starting";
    let activeTtsAbortController: AbortController | null = null;
    const policy = this.policyFor(context.computerId);
    const authorized = true;
    this.events.emitMonitor({ kind: "call-started", sessionId: context.sessionId, computerId: context.computerId, from: context.from });
    let outputQueue = Promise.resolve();
    let greetingMarkTimer: NodeJS.Timeout | null = null;
    const greetingMark = `greeting-complete:${context.callSid}`;
    turnMetrics.alias(context.streamSid, context.sessionId);
    this.synthesizer.prewarm?.(context.streamSid);

    const clearGreetingTimer = () => {
      if (greetingMarkTimer) { clearTimeout(greetingMarkTimer); greetingMarkTimer = null; }
    };
    const enableListening = (via: "mark" | "timeout") => {
      if (closed || phase !== "greeting") return;
      clearGreetingTimer();
      phase = "listening";
      if (via === "mark") logVoice("greeting mark acknowledged", { callSid: context.callSid, streamSid: context.streamSid });
      else logVoice("greeting mark timed out; enabling listening without acknowledgement", { callSid: context.callSid, streamSid: context.streamSid });
      logVoice("listening enabled", { callSid: context.callSid, streamSid: context.streamSid });
    };

    const speak = (text: string, label: "greeting" | "agent-message" | "agent-speech") => {
      outputQueue = outputQueue.then(async () => {
        if (closed) return;
        const controller = new AbortController();
        activeTtsAbortController = controller;
        turnMetrics.mark(context.sessionId, "tts-requested");
        try {
          let firstChunk = true;
          for await (const audio of this.synthesizer.synthesize({ text, callSid: context.callSid, streamSid: context.streamSid, signal: controller.signal })) {
            if (closed || controller.signal.aborted) break;
            if (firstChunk) {
              if (label === "greeting") logVoice("first greeting audio chunk received", { callSid: context.callSid, streamSid: context.streamSid });
              else phase = "speaking";
              turnMetrics.mark(context.sessionId, "tts-first-audio");
            }
            firstChunk = false;
            output.audio(audio);
            turnMetrics.mark(context.sessionId, "twilio-first-frame");
          }
          if (closed || controller.signal.aborted) return;
          if (label === "greeting") {
            logVoice("greeting audio completed", { callSid: context.callSid, streamSid: context.streamSid });
            output.mark(greetingMark);
            logVoice("greeting mark sent", { callSid: context.callSid, streamSid: context.streamSid });
            greetingMarkTimer = setTimeout(() => enableListening("timeout"), this.greetingMarkTimeoutMs);
            greetingMarkTimer.unref?.();
          } else {
            output.mark();
            if (phase === "speaking") phase = "listening";
          }
        } catch (error) {
          logVoice(`${label} synthesis failed`, { callSid: context.callSid, streamSid: context.streamSid, error: sanitizeProviderError(error) });
          onError(error instanceof Error ? error : new Error("Speech synthesis failed"));
        } finally {
          if (activeTtsAbortController === controller) activeTtsAbortController = null;
        }
      });
    };

    const unsubscribe = this.events.subscribe(context.sessionId, ({ event }) => {
      if (closed) return;
      if (event.kind === "agent-speech") speak(event.text, "agent-speech");
      else if (event.kind === "agent-message" && !event.spoken) speak(event.text, "agent-message");
    }, false);

    const transcription: TranscriptionSession = this.recognizer.open({
      callSid: context.callSid,
      streamSid: context.streamSid,
      onTranscript: ({ text }) => {
        if (closed) return;
        turnMetrics.mark(context.sessionId, "transcript-final");
        this.events.emit({ kind: "user-message", sessionId: context.sessionId, text, who: "Caller" });
        if (!authorized) return;
        if (!this.computerExists(context.computerId)) {
          onError(new Error(`Kylian computer ${context.computerId} is not registered`));
          return;
        }
        phase = "thinking";
        this.sessions.enqueue({
          sessionId: context.sessionId,
          computerId: context.computerId,
          text,
          allowedFolders: policy?.allowedFolders ?? [],
          allowedApplications: policy?.allowedApplications ?? [],
        });
      },
      onSpeechActivity: ({ type }) => {
        // No barge-in while the greeting is playing: the caller listens first.
        if (type !== "speech-start" || phase === "starting" || phase === "greeting" || !activeTtsAbortController) return;
        activeTtsAbortController.abort();
        output.clear();
        phase = "listening";
      },
      onError,
    });
    const emitEnded = () => this.events.emitMonitor({ kind: "call-ended", sessionId: context.sessionId });

    logVoice("voice runtime initialized", { callSid: context.callSid, streamSid: context.streamSid, sessionId: context.sessionId, computerId: context.computerId });
    if (!authorized) {
      // Unauthorized caller: speak a rejection and run no orchestration or greeting.
      this.events.emit({ kind: "session-state", sessionId: context.sessionId, state: "failed", status: "Unauthorized", detail: "Caller number is not authorized" });
      this.events.emit({ kind: "agent-message", sessionId: context.sessionId, text: "Sorry, this number is not authorized to use Kylian on this computer." });
    } else {
      phase = "greeting";
      logVoice("greeting started", { callSid: context.callSid, streamSid: context.streamSid });
      speak(this.greeting, "greeting");
    }

    return {
      // Caller audio is dropped until the greeting has finished playing, so no
      // STT, VAD, barge-in, or orchestration can run over the greeting.
      inboundAudio(audio) {
        if (closed || phase === "starting" || phase === "greeting" || phase === "closing") return;
        transcription.appendMulaw(audio);
      },
      markAcknowledged: (name) => {
        if (closed || name !== greetingMark) return;
        enableListening("mark");
      },
      close: () => {
        if (closed) return;
        closed = true;
        phase = "closing";
        clearGreetingTimer();
        activeTtsAbortController?.abort();
        activeTtsAbortController = null;
        transcription.close();
        unsubscribe();
        this.synthesizer.release?.(context.streamSid);
        turnMetrics.unalias(context.streamSid);
        emitEnded();
      },
    };
  }
}
