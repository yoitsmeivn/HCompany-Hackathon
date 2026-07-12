import { performance } from "node:perf_hooks";
import { logVoice } from "./voiceLog.js";

export type TurnStage =
  | "speech-end-candidate"
  | "stt-flush-requested"
  | "stt-flushed"
  | "transcript-final"
  | "openai-start"
  | "openai-first-text"
  | "openai-complete"
  | "tool-start"
  | "tool-complete"
  | "tts-requested"
  | "tts-ready"
  | "tts-first-audio"
  | "twilio-first-frame";

// One conversational turn: caller stops speaking -> Kylian's first audio.
// Marks carry only monotonic timestamps; nothing content-derived is stored.
export class TurnMetrics {
  private readonly aliases = new Map<string, string>();
  private readonly turns = new Map<string, Map<TurnStage, number>>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  alias(from: string, to: string): void { this.aliases.set(from, to); }

  unalias(from: string): void {
    const key = this.aliases.get(from) ?? from;
    this.aliases.delete(from);
    this.turns.delete(key);
  }

  mark(key: string, stage: TurnStage): void {
    const sessionKey = this.aliases.get(key) ?? key;
    if (stage === "speech-end-candidate") this.turns.set(sessionKey, new Map());
    const turn = this.turns.get(sessionKey);
    if (!turn || turn.has(stage)) return;
    turn.set(stage, this.now());
    if (stage === "twilio-first-frame") this.flush(sessionKey, turn);
  }

  private flush(sessionKey: string, turn: Map<TurnStage, number>): void {
    const elapsed = (from: TurnStage, to: TurnStage): number | undefined => {
      const start = turn.get(from);
      const end = turn.get(to);
      return start !== undefined && end !== undefined ? Math.max(0, Math.round(end - start)) : undefined;
    };
    logVoice("turn latency", {
      sessionId: sessionKey,
      vad_ms: elapsed("speech-end-candidate", "stt-flush-requested"),
      stt_finalize_ms: elapsed("stt-flush-requested", "transcript-final"),
      openai_first_text_ms: elapsed("openai-start", "openai-first-text"),
      openai_total_ms: elapsed("openai-start", "openai-complete"),
      tool_ms: elapsed("tool-start", "tool-complete"),
      tts_ready_ms: elapsed("tts-requested", "tts-ready"),
      tts_first_audio_ms: elapsed("tts-requested", "tts-first-audio"),
      total_turn_ms: elapsed("speech-end-candidate", "twilio-first-frame"),
    });
    this.turns.delete(sessionKey);
  }
}

export const turnMetrics = new TurnMetrics();
