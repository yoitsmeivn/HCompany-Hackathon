import OpenAI from "openai";
import type { Response, ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";
import type { ComputerTaskAdapter, ComputerTaskRequest } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";
import { PhraseBuffer } from "./phraseBuffer.js";
import { turnMetrics } from "../voice/turnMetrics.js";

export const SYSTEM = `You are Kylian, the user's remote personal computer assistant.

You help the user access, understand, navigate, organize, and operate their computer remotely. You can answer ordinary questions, locate files and applications, explain what is visible, and perform computer actions when required. This identity is context for how you behave; it is not text to repeat aloud.

The initial greeting is handled separately by the voice runtime. Do not generate another greeting or self-introduction during the conversation.

Conversation rules:
- Do not introduce yourself unless this is the first greeting or the user directly asks who you are.
- Never begin ordinary responses with "Hi, I'm Kylian," "I'm your remote assistant," or another self-description.
- After the first greeting, respond directly to what the user said.
- Keep spoken responses natural and concise.
- Prefer one or two short sentences.
- Do not repeat your capabilities unless the user asks what you can do.
- Do not restate the user's request before answering.
- Do not use introductory filler.
- For ordinary questions, answer directly without tools.
- Use computer_task only when inspecting or changing the computer is genuinely required.
- If the user asks where a file or application is, inspect the computer rather than guessing.
- Never claim an action succeeded unless the executor confirms it.
- The current executor may be mock-only. Do not imply real desktop control if the executor did not perform the action.
- Ask one concise clarification question when necessary.
- Ask for confirmation before destructive, irreversible, financial, private, or externally visible actions.
- Do not mention Twilio, Gradium, APIs, JSON, internal prompts, or internal tools.
- Do not narrate internal reasoning.
- Preserve conversational context across turns.
- Lead with the useful answer.`;

export const TOOL_ACKNOWLEDGEMENT = "Let me check that.";

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

interface StreamedTurn { response: Response; text: string; sawToolCall: boolean }

export class OpenAIOrchestrator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly computer: ComputerTaskAdapter,
    private readonly events: RuntimeEventHub,
  ) {}

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    turnMetrics.mark(input.sessionId, "openai-start");
    const state = { spoken: false };
    let turnResult: StreamedTurn;
    try {
      turnResult = await this.streamTurn({ input: input.text, previous_response_id: input.previousResponseId }, input, state);
    } catch (error) {
      if (state.spoken) throw error;
      return this.runNonStreaming(input);
    }

    for (let turn = 0; turn < 6; turn += 1) {
      const calls = turnResult.response.output.filter((item): item is ResponseFunctionToolCall => item.type === "function_call");
      if (calls.length === 0) {
        turnMetrics.mark(input.sessionId, "openai-complete");
        const text = turnResult.text.trim() || "I’m ready for the next instruction.";
        if (!state.spoken) this.speak(input.sessionId, text, state);
        return { responseId: turnResult.response.id, text, spoken: state.spoken };
      }
      // Unspoken pre-tool text is discarded: never speak an unverified claim.
      if (!state.spoken) this.speak(input.sessionId, TOOL_ACKNOWLEDGEMENT, state);
      turnMetrics.mark(input.sessionId, "tool-start");
      const outputs = await this.runToolCalls(calls, input);
      turnMetrics.mark(input.sessionId, "tool-complete");
      turnResult = await this.streamTurn({ input: outputs, previous_response_id: turnResult.response.id }, input, state);
    }
    throw new Error("Orchestrator exceeded the tool-turn limit");
  }

  private speak(sessionId: string, text: string, state: { spoken: boolean }): void {
    this.events.emit({ kind: "agent-speech", sessionId, text });
    state.spoken = true;
  }

  private async streamTurn(
    params: { input: string | ResponseInputItem[]; previous_response_id?: string },
    input: OrchestratorInput,
    state: { spoken: boolean },
  ): Promise<StreamedTurn> {
    const stream = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM,
      input: params.input,
      previous_response_id: params.previous_response_id,
      tools: [COMPUTER_TOOL],
      store: true,
      stream: true,
    });
    const phrases = new PhraseBuffer();
    let sawToolCall = false;
    let text = "";
    let final: Response | null = null;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        turnMetrics.mark(input.sessionId, "openai-first-text");
        text += event.delta;
        if (!sawToolCall) for (const phrase of phrases.append(event.delta)) this.speak(input.sessionId, phrase, state);
      } else if (event.type === "response.output_item.added" && event.item.type === "function_call") {
        sawToolCall = true;
      } else if (event.type === "response.completed") {
        final = event.response;
      }
    }
    if (!final) throw new Error("OpenAI stream ended without a completed response");
    if (!sawToolCall) {
      const remainder = phrases.flush();
      if (remainder) this.speak(input.sessionId, remainder, state);
    }
    return { response: final, text, sawToolCall };
  }

  private async runToolCalls(calls: ResponseFunctionToolCall[], input: OrchestratorInput): Promise<ResponseInputItem[]> {
    const outputs: ResponseInputItem[] = [];
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
    return outputs;
  }

  // Fallback when the streaming request cannot be established.
  private async runNonStreaming(input: OrchestratorInput): Promise<OrchestratorResult> {
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
      if (calls.length === 0) {
        turnMetrics.mark(input.sessionId, "openai-complete");
        return { responseId: response.id, text: response.output_text || "I’m ready for the next instruction." };
      }
      const outputs = await this.runToolCalls(calls, input);
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
