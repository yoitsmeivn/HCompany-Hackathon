import assert from "node:assert/strict";
import test from "node:test";
import { MockComputerTaskAdapter } from "./computer/mockComputerTaskAdapter.js";
import { MockOrchestrator } from "./orchestrator/mockOrchestrator.js";
import { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "./runtime/eventHub.js";
import type { RuntimeEventEnvelope } from "../shared/runtimeEvents.js";

test("orchestrates a message into typed mock runtime events", async () => {
  const events = new RuntimeEventHub();
  const received: RuntimeEventEnvelope[] = [];
  events.subscribe("session-1", (event) => received.push(event));
  const orchestrator = new MockOrchestrator(new MockComputerTaskAdapter(), events);
  const sessions = new SessionOrchestrationService(orchestrator, events);
  sessions.enqueue({ sessionId: "session-1", computerId: "computer-1", text: "Find report.pdf", allowedFolders: ["Documents"], allowedApplications: ["Finder"] });

  await waitFor(() => received.some(({ event }) => event.kind === "agent-message"));
  assert.deepEqual(received.map(({ event }) => event.kind), [
    "session-state",
    "computer-action",
    "computer-action",
    "candidate-file",
    "approval-requested",
    "session-state",
    "agent-message",
  ]);
});

test("replays recent events to a late session subscriber", () => {
  const events = new RuntimeEventHub();
  events.emit({ kind: "agent-message", sessionId: "late", text: "ready" });
  const received: RuntimeEventEnvelope[] = [];
  events.subscribe("late", (event) => received.push(event));
  assert.equal(received[0]?.event.kind, "agent-message");
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for runtime events");
}
