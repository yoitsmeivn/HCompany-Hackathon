import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { ComputerTaskAdapter, ComputerTaskRequest } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { Orchestrator } from "./sessionOrchestrationService.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";
import { runComputerTask } from "./computerTaskRunner.js";

/**
 * Text-channel brain running on an H Company (Holo) model through its
 * OpenAI-compatible **Chat Completions** API. This is the same model NemoClaw
 * runs in-sandbox, so WhatsApp/web and the NemoClaw side-challenge share one H
 * Company brain. Holo does not implement the OpenAI Responses API, so this
 * orchestrator keeps its own per-session message history instead of relying on
 * `previous_response_id`.
 */

export const HOLO_SYSTEM = `You are Kylian, the user's remote personal computer assistant, reachable over text (WhatsApp and web).

You help the user access, understand, navigate, organize, and operate their computer remotely. You can answer ordinary questions, locate files and applications, explain what is visible, and perform computer actions when required.

Rules:
- Answer directly and concisely; this is a text conversation.
- For ordinary questions, answer without tools.
- Use computer_task only when inspecting or changing the computer is genuinely required.
- If the user asks where a file or application is, inspect the computer rather than guessing.
- Never claim an action succeeded unless the executor confirms it. The executor may be mock-only; do not imply real desktop control if the executor did not perform the action.
- Ask one concise clarification question when necessary.
- Ask for confirmation before destructive, irreversible, financial, private, or externally visible actions.
- Do not mention Twilio, Gradium, NemoClaw, APIs, JSON, internal prompts, or internal tools.
- Lead with the useful answer.`;

const COMPUTER_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "computer_task",
    description: "Run an authorized task on the user's selected computer through the configured execution adapter.",
    parameters: {
      type: "object",
      properties: { instruction: { type: "string", description: "A precise computer task instruction." } },
      required: ["instruction"],
      additionalProperties: false,
    },
  },
};

const MAX_TOOL_TURNS = 6;
// Keep per-session history bounded so a long-lived WhatsApp thread cannot grow
// the request payload without limit. Oldest turns are dropped, the system
// prompt is always re-prepended fresh.
const MAX_HISTORY_MESSAGES = 40;

export class HoloOrchestrator implements Orchestrator {
  private readonly history = new Map<string, ChatCompletionMessageParam[]>();

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly computer: ComputerTaskAdapter,
    private readonly events: RuntimeEventHub,
  ) {}

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const messages: ChatCompletionMessageParam[] = [
      ...(this.history.get(input.sessionId) ?? []),
      { role: "user", content: input.text },
    ];

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "system", content: HOLO_SYSTEM }, ...messages],
        tools: [COMPUTER_TOOL],
        tool_choice: "auto",
      });
      const choice = completion.choices[0]?.message;
      if (!choice) throw new Error("Holo returned no message");
      const toolCalls = (choice.tool_calls ?? []).filter(
        (call): call is ChatCompletionMessageToolCall & { type: "function" } => call.type === "function",
      );

      if (toolCalls.length === 0) {
        const text = (choice.content ?? "").trim() || "I’m ready for the next instruction.";
        messages.push({ role: "assistant", content: text });
        this.remember(input.sessionId, messages);
        return { text };
      }

      messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls });
      for (const call of toolCalls) {
        if (call.function.name !== "computer_task") throw new Error(`Unsupported tool: ${call.function.name}`);
        const request = parseComputerTask(call.function.arguments, input);
        const result = await runComputerTask(this.computer, this.events, request);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    throw new Error("Orchestrator exceeded the tool-turn limit");
  }

  private remember(sessionId: string, messages: ChatCompletionMessageParam[]): void {
    this.history.set(sessionId, messages.slice(-MAX_HISTORY_MESSAGES));
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
  return {
    sessionId: input.sessionId,
    computerId: input.computerId,
    instruction,
    allowedFolders: input.allowedFolders,
    allowedApplications: input.allowedApplications,
  };
}
