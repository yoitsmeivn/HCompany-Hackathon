import type { ComputerTaskAdapter, ComputerTaskRequest, ComputerTaskResult } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";

/**
 * Runs a single computer task through the configured adapter and publishes the
 * typed runtime events the UIs and voice/text channels consume. Shared by every
 * brain (OpenAI Responses, Holo chat) so the observable session behaviour is
 * identical regardless of which model planned the task.
 */
export async function runComputerTask(
  computer: ComputerTaskAdapter,
  events: RuntimeEventHub,
  request: ComputerTaskRequest,
): Promise<ComputerTaskResult> {
  const sessionId = request.sessionId;
  events.emit({ kind: "computer-action", sessionId, label: request.instruction, state: "current" });
  const result = await computer.run(request);
  events.emit({ kind: "computer-action", sessionId, label: result.summary, state: "done" });
  for (const candidate of result.candidates ?? []) events.emit({ kind: "candidate-file", sessionId, candidate });
  if (result.approval) {
    events.emit({ kind: "approval-requested", sessionId, ...result.approval });
    events.emit({ kind: "session-state", sessionId, state: "waiting", status: "Waiting", detail: "Waiting for your approval" });
  }
  return result;
}
