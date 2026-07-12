import type { ComputerTaskAdapter } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";

export class MockOrchestrator {
  constructor(private readonly computer: ComputerTaskAdapter, private readonly events: RuntimeEventHub) {}
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: input.text, state: "current" });
    const result = await this.computer.run({ ...input, instruction: input.text });
    this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: result.summary, state: "done" });
    for (const candidate of result.candidates ?? []) this.events.emit({ kind: "candidate-file", sessionId: input.sessionId, candidate });
    if (result.approval) {
      this.events.emit({ kind: "approval-requested", sessionId: input.sessionId, ...result.approval });
      this.events.emit({ kind: "session-state", sessionId: input.sessionId, state: "waiting", status: "Waiting", detail: "Waiting for your approval" });
    }
    return { text: result.summary };
  }
}
