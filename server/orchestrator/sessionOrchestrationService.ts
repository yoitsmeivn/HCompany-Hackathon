import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";

export interface Orchestrator { run(input: OrchestratorInput): Promise<OrchestratorResult> }

export class SessionOrchestrationService {
  private readonly responseIds = new Map<string, string>();
  private readonly queues = new Map<string, Promise<void>>();
  constructor(private readonly orchestrator: Orchestrator, private readonly events: RuntimeEventHub) {}

  enqueue(input: Omit<OrchestratorInput, "previousResponseId">): void {
    const previous = this.queues.get(input.sessionId) ?? Promise.resolve();
    const next = previous.then(() => this.process(input)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "The orchestrator failed";
      this.events.emit({ kind: "agent-message", sessionId: input.sessionId, text: `I couldn’t complete that request: ${message}` });
      this.events.emit({ kind: "session-state", sessionId: input.sessionId, state: "failed", status: "Failed", detail: message });
    });
    this.queues.set(input.sessionId, next);
    void next.finally(() => { if (this.queues.get(input.sessionId) === next) this.queues.delete(input.sessionId); });
  }

  private async process(input: Omit<OrchestratorInput, "previousResponseId">): Promise<void> {
    this.events.emit({ kind: "session-state", sessionId: input.sessionId, state: "active", status: "Active", detail: "Kylian is working" });
    const result = await this.orchestrator.run({ ...input, previousResponseId: this.responseIds.get(input.sessionId) });
    if (result.responseId) this.responseIds.set(input.sessionId, result.responseId);
    this.events.emit({ kind: "agent-message", sessionId: input.sessionId, text: result.text });
  }
}
