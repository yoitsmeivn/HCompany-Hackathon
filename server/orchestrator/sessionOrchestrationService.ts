import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";

export interface Orchestrator { run(input: OrchestratorInput): Promise<OrchestratorResult> }

export class SessionOrchestrationService {
  private readonly responseIds = new Map<string, string>();
  private readonly queues = new Map<string, Promise<void>>();
  constructor(private readonly orchestrator: Orchestrator, private readonly events: RuntimeEventHub) {}

  enqueue(input: Omit<OrchestratorInput, "previousResponseId">): void {
    const next = this.chain(input).then(() => undefined, (error: unknown) => this.emitFailure(input.sessionId, error));
    this.track(input.sessionId, next);
  }

  /**
   * Serialized, awaitable variant of {@link enqueue}. Runs the message through
   * the same per-session queue and resolves with the orchestrator result so a
   * synchronous caller (e.g. the NemoClaw/WhatsApp ingress) can relay the reply.
   * Rejects on failure after emitting the same runtime failure events.
   */
  handle(input: Omit<OrchestratorInput, "previousResponseId">): Promise<OrchestratorResult> {
    const run = this.chain(input);
    this.track(input.sessionId, run.then(() => undefined, () => undefined));
    return run.catch((error: unknown) => {
      this.emitFailure(input.sessionId, error);
      throw error instanceof Error ? error : new Error("The orchestrator failed");
    });
  }

  private chain(input: Omit<OrchestratorInput, "previousResponseId">): Promise<OrchestratorResult> {
    const previous = this.queues.get(input.sessionId) ?? Promise.resolve();
    return previous.catch(() => undefined).then(() => this.process(input));
  }

  private track(sessionId: string, settled: Promise<void>): void {
    this.queues.set(sessionId, settled);
    void settled.finally(() => { if (this.queues.get(sessionId) === settled) this.queues.delete(sessionId); });
  }

  private emitFailure(sessionId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : "The orchestrator failed";
    this.events.emit({ kind: "agent-message", sessionId, text: `I couldn’t complete that request: ${message}` });
    this.events.emit({ kind: "session-state", sessionId, state: "failed", status: "Failed", detail: message });
  }

  private async process(input: Omit<OrchestratorInput, "previousResponseId">): Promise<OrchestratorResult> {
    this.events.emit({ kind: "session-state", sessionId: input.sessionId, state: "active", status: "Active", detail: "Kylian is working" });
    const result = await this.orchestrator.run({ ...input, previousResponseId: this.responseIds.get(input.sessionId) });
    if (result.responseId) this.responseIds.set(input.sessionId, result.responseId);
    this.events.emit({ kind: "agent-message", sessionId: input.sessionId, text: result.text });
    return result;
  }
}
