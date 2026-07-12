import OpenAI from "openai";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import type { ComputerTaskAdapter, ComputerTaskRequest } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";

const SYSTEM = `You are Kylian, an orchestrator for user-authorized computer tasks. Use the computer_task tool when the request requires looking at or acting on the user's computer. Never claim an action happened unless the tool result confirms it. Ask for approval before delivery or external side effects.`;

const COMPUTER_TOOL = {
  type: "function" as const,
  name: "computer_task",
  description: "Run an authorized task on the user's selected computer through the configured execution adapter.",
  strict: true,
  parameters: {
    type: "object",
    properties: { instruction: { type: "string", description: "A precise computer task instruction." } },
    required: ["instruction"],
    additionalProperties: false,
  },
};

export class OpenAIOrchestrator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly computer: ComputerTaskAdapter,
    private readonly events: RuntimeEventHub,
  ) {}

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    let response = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM,
      input: input.text,
      previous_response_id: input.previousResponseId,
      tools: [COMPUTER_TOOL],
      store: true,
    });

    for (let turn = 0; turn < 6; turn += 1) {
      const calls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === "function_call");
      if (calls.length === 0) return { responseId: response.id, text: response.output_text || "I’m ready for the next instruction." };
      const outputs = [];
      for (const call of calls) {
        if (call.name !== "computer_task") throw new Error(`Unsupported tool: ${call.name}`);
        const request = parseComputerTask(call.arguments, input);
        this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: request.instruction, state: "current" });
        const result = await this.computer.run(request);
        this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: result.summary, state: "done" });
        for (const candidate of result.candidates ?? []) this.events.emit({ kind: "candidate-file", sessionId: input.sessionId, candidate });
        if (result.approval) {
          this.events.emit({ kind: "approval-requested", sessionId: input.sessionId, ...result.approval });
          this.events.emit({ kind: "session-state", sessionId: input.sessionId, state: "waiting", status: "Waiting", detail: "Waiting for your approval" });
        }
        outputs.push({ type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(result) });
      }
      response = await this.client.responses.create({ model: this.model, previous_response_id: response.id, input: outputs, tools: [COMPUTER_TOOL], store: true });
    }
    throw new Error("Orchestrator exceeded the tool-turn limit");
  }
}

function parseComputerTask(raw: string, input: OrchestratorInput): ComputerTaskRequest {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("computer_task arguments were not valid JSON"); }
  if (!value || typeof value !== "object" || typeof (value as { instruction?: unknown }).instruction !== "string") {
    throw new Error("computer_task requires an instruction string");
  }
  const instruction = (value as { instruction: string }).instruction.trim();
  if (!instruction) throw new Error("computer_task instruction cannot be empty");
  return { sessionId: input.sessionId, computerId: input.computerId, instruction, allowedFolders: input.allowedFolders, allowedApplications: input.allowedApplications };
}
