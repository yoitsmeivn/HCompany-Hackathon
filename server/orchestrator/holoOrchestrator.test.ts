import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { ComputerTaskAdapter, ComputerTaskRequest } from "../computer/types.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { HoloOrchestrator, HOLO_SYSTEM } from "./holoOrchestrator.js";

test("Holo system prompt frames a text assistant that only uses tools when required", () => {
  assert.match(HOLO_SYSTEM, /remote personal computer assistant/);
  assert.match(HOLO_SYSTEM, /this is a text conversation/);
  assert.match(HOLO_SYSTEM, /Use computer_task only when inspecting or changing the computer is genuinely required/);
  assert.match(HOLO_SYSTEM, /Never claim an action succeeded unless the executor confirms it/);
  assert.match(HOLO_SYSTEM, /Do not mention Twilio, Gradium, NemoClaw/);
});

test("ordinary questions return text and never call computer_task", async () => {
  const events = new RuntimeEventHub();
  const computer = new RecordingComputer();
  const client = new FakeHolo([assistant("Files live in Documents. What next?")]);
  const orchestrator = new HoloOrchestrator(client as unknown as OpenAI, "holo-test", computer, events);

  const result = await orchestrator.run(input("Where do my files live?"));

  assert.equal(result.text, "Files live in Documents. What next?");
  assert.equal(computer.requests.length, 0);
  // First (and only) call sees the Holo system prompt as the leading message.
  assert.equal(client.calls[0].messages[0].role, "system");
  assert.equal(client.calls[0].model, "holo-test");
});

test("computer requests run the tool, emit runtime events, then return the verified reply", async () => {
  const events = new RuntimeEventHub();
  const captured = captureEvents(events);
  const computer = new RecordingComputer();
  const client = new FakeHolo([
    toolCall("call-1", { instruction: "Find the latest report" }),
    assistant("Found report.pdf in Documents. Want me to send it?"),
  ]);
  const orchestrator = new HoloOrchestrator(client as unknown as OpenAI, "holo-test", computer, events);

  const result = await orchestrator.run(input("Find my latest report"));

  assert.deepEqual(computer.requests.map((r) => r.instruction), ["Find the latest report"]);
  assert.equal(result.text, "Found report.pdf in Documents. Want me to send it?");
  // The shared runtime-event contract fired: action start/done + candidate + approval + waiting.
  assert.deepEqual(captured.actions, ["Find the latest report", "Handled report.pdf"]);
  assert.deepEqual(captured.candidates, ["report.pdf"]);
  assert.equal(captured.approvals, 1);
  assert.ok(captured.states.includes("waiting"));
  // The tool result is fed back to the model on the second call.
  const second = client.calls[1].messages;
  assert.equal(second.some((m) => m.role === "tool"), true);
});

test("per-session history is retained across turns", async () => {
  const events = new RuntimeEventHub();
  const client = new FakeHolo([assistant("First answer."), assistant("Second answer.")]);
  const orchestrator = new HoloOrchestrator(client as unknown as OpenAI, "holo-test", new RecordingComputer(), events);

  await orchestrator.run(input("First question"));
  await orchestrator.run(input("Second question"));

  // The second call's messages include the prior user+assistant turn (memory),
  // not just the fresh system prompt and new question.
  const roles = client.calls[1].messages.map((m) => m.role);
  const contents = client.calls[1].messages.map((m) => m.content);
  assert.ok(contents.includes("First question"));
  assert.ok(contents.includes("First answer."));
  assert.ok(contents.includes("Second question"));
  assert.equal(roles[0], "system");
});

test("empty model content still yields a safe non-empty reply", async () => {
  const events = new RuntimeEventHub();
  const client = new FakeHolo([assistant("")]);
  const orchestrator = new HoloOrchestrator(client as unknown as OpenAI, "holo-test", new RecordingComputer(), events);
  const result = await orchestrator.run(input("Hi"));
  assert.equal(result.text, "I’m ready for the next instruction.");
});

function input(text: string) {
  return { sessionId: "session-1", computerId: "demo-computer", text, allowedFolders: [], allowedApplications: [], channel: "text" as const };
}

interface FakeMessage { role: string; content: string; tool_calls?: unknown }

function assistant(content: string): { choices: [{ message: FakeMessage }] } {
  return { choices: [{ message: { role: "assistant", content } }] };
}

function toolCall(id: string, args: Record<string, unknown>): { choices: [{ message: FakeMessage }] } {
  return {
    choices: [{ message: {
      role: "assistant",
      content: "",
      tool_calls: [{ id, type: "function", function: { name: "computer_task", arguments: JSON.stringify(args) } }],
    } }],
  };
}

function captureEvents(events: RuntimeEventHub) {
  const captured = { actions: [] as string[], candidates: [] as string[], approvals: 0, states: [] as string[] };
  events.subscribe("session-1", ({ event }) => {
    if (event.kind === "computer-action") captured.actions.push(event.label);
    else if (event.kind === "candidate-file") captured.candidates.push(event.candidate.name);
    else if (event.kind === "approval-requested") captured.approvals += 1;
    else if (event.kind === "session-state") captured.states.push(event.state);
  });
  return captured;
}

class FakeHolo {
  calls: Array<{ model: string; messages: FakeMessage[]; tools?: unknown }> = [];
  constructor(private readonly turns: Array<{ choices: [{ message: FakeMessage }] }>) {}
  chat = {
    completions: {
      create: async (args: { model: string; messages: FakeMessage[]; tools?: unknown }) => {
        this.calls.push({ model: args.model, messages: args.messages, tools: args.tools });
        return this.turns[this.calls.length - 1] ?? assistant("done");
      },
    },
  };
}

class RecordingComputer implements ComputerTaskAdapter {
  readonly provider = "h-company" as const;
  requests: ComputerTaskRequest[] = [];
  async run(request: ComputerTaskRequest) {
    this.requests.push(request);
    return {
      taskId: "task-1",
      status: "waiting_for_approval" as const,
      summary: "Handled report.pdf",
      candidates: [{ name: "report.pdf", meta: "recent", ext: "PDF" }],
      approval: { summary: "Ready to send report.pdf", fileName: "report.pdf" },
    };
  }
  async steer(): Promise<void> {}
  async pause(): Promise<void> {}
  async stop(): Promise<void> {}
}
