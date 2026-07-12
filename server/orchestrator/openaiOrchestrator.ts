import OpenAI from "openai";
import type { Response, ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";
import type { ComputerTaskAdapter, ComputerTaskRequest } from "../computer/types.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";
import { PhraseBuffer } from "./phraseBuffer.js";
import { turnMetrics } from "../voice/turnMetrics.js";
import { isTwilioMediaSupported, type ArtifactStore } from "../artifacts/artifactStore.js";
import type { ArtifactPublisher } from "../artifacts/artifactPublisher.js";
import type { ZipService } from "../artifacts/zipService.js";
import { ArtifactPipelineError, ARTIFACT_ERROR_MESSAGE } from "../artifacts/errorCodes.js";
import { logArtifactStage } from "../artifacts/log.js";
import {
  ApprovalRegistry,
  buildCommunicationInstruction,
  mapCommunicationOutcome,
  type CommunicationApplication,
  type CommunicationRequest,
  type SendMode,
} from "./communicationTask.js";

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
- Before dispatching a computer_task whose instruction contains money amounts, long numbers, decimals, dates, phone numbers, or arithmetic, repeat the numbers back and ask the user to confirm them first (for example: "I heard 4,800 multiplied by 0.12 — should I run that on your computer?"). Never silently send ambiguous numbers to the computer.
- Only send a WhatsApp message when the user explicitly asks you to send one. It always goes to the owner's own WhatsApp; never invent recipients.

Communication routing — exactly two delivery paths exist:
- WhatsApp delivery to the owner uses the Twilio tools (send_whatsapp_message, send_whatsapp_artifact). Use them whenever the user explicitly says WhatsApp.
- Email, Gmail, Slack, LinkedIn, Discord, websites, WhatsApp Web, and every other app use communicate_via_computer, which drives the real logged-in browser or desktop app. Never suggest or assume a direct API for these.
- For any email request, you MUST call communicate_via_computer with application "gmail" (the logged-in Gmail in the browser). Never use computer_task to open Mail.app or to compose, attach, or send an email — computer_task is only for locating files and other non-communication desktop work.
- To attach or deliver a file: first call computer_task to locate it and explicitly instruct it to "report the file's full absolute path (starting with /Users/)". The system converts that path into an artifacts[] entry with an artifactId. Then pass that artifactId to communicate_via_computer or send_whatsapp_artifact. Never describe a file by name in a second task and never ask the tool to re-find it.
- If a file was already located earlier in this same turn, reuse its artifactId — never run another search for it.
- When the user asked for WhatsApp delivery, do not offer email instead. send_whatsapp_artifact handles every file type: supported types go as media, others as a secure link automatically. Only report a problem if the tool result contains an error code.
- To send several files together or when the user says "zip"/"compress", use zip_and_send_whatsapp with the artifactIds.
- If the user says "message them" without naming a platform, ask which application or website to use.
- If the user says "send it to me" about a file you already located, ask "WhatsApp or email?" unless the context clearly specifies one.
- If the user says "send it however is easiest", prefer WhatsApp when it is available and the file type is supported; otherwise create a Gmail draft in the browser.
- Never invent a recipient, email address, or phone number. Never message third parties without the user's confirmation. Never upload or send files unless delivery was requested.
- Use Twilio (not WhatsApp Web) for the owner's own WhatsApp. WhatsApp Web is only for explicitly named other contacts.
- To send a file to the owner's own WhatsApp ("WhatsApp this to me", "send my resume to my WhatsApp"), use send_whatsapp_artifact (Twilio). Never use WhatsApp Web or communicate_via_computer for owner file delivery.
- "Email X to me" / "email my resume to me": find the file if needed, then call communicate_via_computer with application "gmail", recipientOrDestination "me", attach the artifactId, and sendMode "send" — an explicit email/send verb to the owner's own address authorizes the send. "Draft an email" uses sendMode "draft" and stops before sending. "Send this to <someone else>" uses sendMode "draft" first and asks for confirmation before a send.
- To send via communicate_via_computer: first create a draft (sendMode "draft"), tell the user what is ready and ask for confirmation, then send with sendMode "send" and the approvalId from the draft. Messages to the user's own addresses still follow this draft-confirm-send flow.
- Files located by computer_task come back as artifacts with artifactId values. Pass artifactId to delivery tools; you never see or use local file paths.
- Report honestly: "sent" only when the tool result says sent or Twilio accepted the message; a draft is "ready to send", never "sent"; say when something was blocked by a login.
- computer_task instructions drive a visual agent that reads the screen. Name the exact application to use (use the one the user named), describe the goal and what visible result to read back, and end with a stop condition. Do not write shell commands or scripts in the instruction; ask the agent to use the application's interface.
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

// Declared only when a WhatsApp sender is configured. The model supplies the
// message text only — the recipient is always the owner's configured WhatsApp
// (KYLIAN_WHATSAPP_DEFAULT_TO); it can never choose a phone number.
const WHATSAPP_TOOL = {
  type: "function" as const,
  name: "send_whatsapp_message",
  description: "Send a WhatsApp text message to the owner's own WhatsApp. Use only when the user explicitly asks to send a WhatsApp message.",
  strict: true,
  parameters: {
    type: "object",
    properties: { message: { type: "string", description: "The message text to send." } },
    required: ["message"],
    additionalProperties: false,
  },
};

export interface WhatsAppTextSender {
  sendWhatsAppText(input: { to?: string; body: string; idempotencyKey?: string }): Promise<{ sid: string; status: string }>;
  sendWhatsAppMedia?(input: { mediaUrl: string; caption?: string; to?: string; idempotencyKey?: string }): Promise<{ sid: string; status: string }>;
}

export interface CommunicationDeps {
  artifacts: ArtifactStore;
  publisher: ArtifactPublisher;
  zip: ZipService;
}

// Sends the owner's own artifact (previously located by computer_task) to the
// owner's WhatsApp. The model supplies an opaque artifactId only — never a
// path or URL — and the recipient is fixed to KYLIAN_WHATSAPP_DEFAULT_TO.
const WHATSAPP_ARTIFACT_TOOL = {
  type: "function" as const,
  name: "send_whatsapp_artifact",
  description:
    "Send a file that computer_task already located (identified by its artifactId) to the owner's own WhatsApp. Use only when the user asked for WhatsApp delivery of that file.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      artifactId: { type: "string", description: "The artifactId returned by a previous computer_task result." },
      caption: { type: ["string", "null"], description: "Optional short caption for the file." },
    },
    required: ["artifactId", "caption"],
    additionalProperties: false,
  },
};

// Zip several already-located files and deliver the archive to the owner's
// WhatsApp. Use only when the user asks to zip/compress or when multiple files
// should arrive together.
const ZIP_AND_SEND_TOOL = {
  type: "function" as const,
  name: "zip_and_send_whatsapp",
  description:
    "Compress two or more already-located files (by their artifactIds) into a single ZIP and send it to the owner's own WhatsApp. Use when the user asks to zip/compress files or to send several files together.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      artifactIds: { type: "array", items: { type: "string" }, description: "artifactIds of the files to include." },
      zipName: { type: ["string", "null"], description: "Optional name for the ZIP, e.g. 'documents.zip'." },
      caption: { type: ["string", "null"], description: "Optional short caption." },
    },
    required: ["artifactIds", "zipName", "caption"],
    additionalProperties: false,
  },
};

// All non-WhatsApp communication (Gmail, Slack, LinkedIn, Discord, WhatsApp
// Web, other apps) runs through HoloDesktop with server-built bounded
// instructions. Third-party sends require an approvalId issued by a prior
// draft; the server rejects unapproved sends before touching the desktop.
const COMMUNICATE_TOOL = {
  type: "function" as const,
  name: "communicate_via_computer",
  description:
    "Draft or send a message using the real logged-in browser or desktop app (Gmail, Slack, LinkedIn, Discord, WhatsApp Web, or another named app) via desktop control. Drafting returns an approvalId; sending requires that approvalId after the user confirms.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      application: { type: "string", enum: ["gmail", "slack", "linkedin", "discord", "whatsapp_web", "other"] },
      applicationName: { type: ["string", "null"], description: "Name of the app or website when application is 'other'." },
      action: { type: "string", description: "The exact operation, e.g. 'Create a new email draft' or 'Draft a reply to the latest message'." },
      recipientOrDestination: { type: "string", description: "Exact recipient, channel, or destination as the user named it." },
      message: { type: ["string", "null"], description: "Exact message or body text, or null when not applicable." },
      subject: { type: ["string", "null"], description: "Email subject when applicable." },
      artifactId: { type: ["string", "null"], description: "artifactId of a previously located file to attach, or null." },
      sendMode: { type: "string", enum: ["draft", "send"] },
      approvalId: { type: ["string", "null"], description: "Required for sendMode 'send': the approvalId from the prior draft, after the user confirmed." },
    },
    required: ["application", "applicationName", "action", "recipientOrDestination", "message", "subject", "artifactId", "sendMode", "approvalId"],
    additionalProperties: false,
  },
};

interface StreamedTurn { response: Response; text: string; sawToolCall: boolean }

// Per-user-turn state: the final-response gate. `spoken` prevents double-voice,
// the range set dedupes TTS chunks, and `recoveryUsed` bounds artifact recovery
// to one attempt per turn.
interface TurnContext {
  turnId: string;
  spoken: boolean;
  recoveryUsed: boolean;
  spokenCursor: number;
  emittedRanges: Set<string>;
}

export class OpenAIOrchestrator {
  private readonly approvals = new ApprovalRegistry();
  private turnCounter = 0;

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly computer: ComputerTaskAdapter,
    private readonly events: RuntimeEventHub,
    private readonly whatsappSender?: WhatsAppTextSender,
    private readonly comms?: CommunicationDeps,
    private readonly ownerEmail?: string,
  ) {}

  private get tools() {
    const artifactDelivery = Boolean(this.whatsappSender?.sendWhatsAppMedia && this.comms);
    return [
      COMPUTER_TOOL,
      COMMUNICATE_TOOL,
      ...(this.whatsappSender ? [WHATSAPP_TOOL] : []),
      ...(artifactDelivery ? [WHATSAPP_ARTIFACT_TOOL, ZIP_AND_SEND_TOOL] : []),
    ];
  }

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    turnMetrics.mark(input.sessionId, "openai-start");
    const ctx = this.newTurn(input.sessionId);
    let turnResult: StreamedTurn;
    try {
      turnResult = await this.streamTurn({ input: input.text, previous_response_id: input.previousResponseId }, input, ctx);
    } catch (error) {
      // Fallback only when nothing was spoken yet, so streaming and the
      // fallback can never both voice the same turn.
      if (ctx.spoken) throw error;
      return this.runNonStreaming(input, ctx);
    }

    for (let turn = 0; turn < 6; turn += 1) {
      const calls = turnResult.response.output.filter((item): item is ResponseFunctionToolCall => item.type === "function_call");
      if (calls.length === 0) {
        turnMetrics.mark(input.sessionId, "openai-complete");
        const text = turnResult.text.trim() || "I’m ready for the next instruction.";
        if (!ctx.spoken) this.speak(input.sessionId, text, ctx);
        return { responseId: turnResult.response.id, text, spoken: ctx.spoken };
      }
      // Unspoken pre-tool text is discarded: never speak an unverified claim.
      if (!ctx.spoken) this.speak(input.sessionId, TOOL_ACKNOWLEDGEMENT, ctx);
      turnMetrics.mark(input.sessionId, "tool-start");
      const outputs = await this.runToolCalls(calls, input, ctx);
      turnMetrics.mark(input.sessionId, "tool-complete");
      turnResult = await this.streamTurn({ input: outputs, previous_response_id: turnResult.response.id }, input, ctx);
    }
    throw new Error("Orchestrator exceeded the tool-turn limit");
  }

  private newTurn(sessionId: string): TurnContext {
    return { turnId: `${sessionId}:${++this.turnCounter}`, spoken: false, recoveryUsed: false, spokenCursor: 0, emittedRanges: new Set() };
  }

  /**
   * Emit one speech range for the turn. Uses a deterministic
   * `<turnId>:<start>:<end>` key so a range is never voiced twice (dedupes a
   * final flush that repeats already-spoken text, or a re-emitted callback).
   */
  private speak(sessionId: string, text: string, ctx: TurnContext): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const start = ctx.spokenCursor;
    const end = start + text.length;
    ctx.spokenCursor = end;
    const key = `${ctx.turnId}:${start}:${end}`;
    if (ctx.emittedRanges.has(key)) return;
    ctx.emittedRanges.add(key);
    this.events.emit({ kind: "agent-speech", sessionId, text: trimmed });
    ctx.spoken = true;
  }

  private async streamTurn(
    params: { input: string | ResponseInputItem[]; previous_response_id?: string },
    input: OrchestratorInput,
    ctx: TurnContext,
  ): Promise<StreamedTurn> {
    const stream = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM,
      input: params.input,
      previous_response_id: params.previous_response_id,
      tools: this.tools,
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
        if (!sawToolCall) for (const phrase of phrases.append(event.delta)) this.speak(input.sessionId, phrase, ctx);
      } else if (event.type === "response.output_item.added" && event.item.type === "function_call") {
        sawToolCall = true;
      } else if (event.type === "response.completed") {
        final = event.response;
      }
    }
    if (!final) throw new Error("OpenAI stream ended without a completed response");
    if (!sawToolCall) {
      const remainder = phrases.flush();
      if (remainder) this.speak(input.sessionId, remainder, ctx);
    }
    return { response: final, text, sawToolCall };
  }

  private async runToolCalls(calls: ResponseFunctionToolCall[], input: OrchestratorInput, ctx: TurnContext): Promise<ResponseInputItem[]> {
    const outputs: ResponseInputItem[] = [];
    for (const call of calls) {
      if (call.name === "send_whatsapp_message" && this.whatsappSender) {
        outputs.push(await this.runWhatsAppSend(call));
        continue;
      }
      if (call.name === "send_whatsapp_artifact" && this.whatsappSender?.sendWhatsAppMedia && this.comms) {
        outputs.push(await this.runWhatsAppArtifactSend(call, input));
        continue;
      }
      if (call.name === "communicate_via_computer") {
        outputs.push(await this.runCommunication(call, input));
        continue;
      }
      if (call.name === "zip_and_send_whatsapp" && this.whatsappSender?.sendWhatsAppMedia && this.comms) {
        outputs.push(await this.runZipAndSend(call, input));
        continue;
      }
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
      const payload = await this.buildComputerTaskPayload(input, result, ctx);
      outputs.push({ type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(payload) });
    }
    return outputs;
  }

  /**
   * Turn a computer_task result into the model-facing payload: register located
   * files as opaque artifacts (structured payload first, free-text regex as a
   * fallback), scrub any paths from the summary, and — if the agent clearly
   * found a file but returned no usable path — run ONE bounded recovery task
   * this turn. The model only ever sees {artifactId, displayName, mimeType,
   * sizeBytes}, never a local path.
   */
  private async buildComputerTaskPayload(
    input: OrchestratorInput,
    result: Awaited<ReturnType<ComputerTaskAdapter["run"]>>,
    ctx: TurnContext,
  ): Promise<Record<string, unknown>> {
    if (!this.comms) return { ...result };
    let summary = result.summary;
    const artifacts: Array<{ artifactId: string; displayName: string; mimeType: string; sizeBytes: number }> = [];

    // 1) Structured artifacts reported by HoloDesktop (primary path).
    for (const item of result.artifacts ?? []) {
      const outcome = await this.comms.artifacts.registerWithReason(input.sessionId, item.localPath);
      if ("artifact" in outcome) {
        artifacts.push(outcome.artifact);
        summary = summary.split(item.localPath).join(outcome.artifact.displayName);
        logArtifactStage({ turnId: ctx.turnId, taskId: result.taskId, stage: "register_structured", filename: outcome.artifact.displayName, mimeType: outcome.artifact.mimeType, sizeBytes: outcome.artifact.sizeBytes });
      } else {
        logArtifactStage({ turnId: ctx.turnId, taskId: result.taskId, stage: "register_structured", code: outcome.code, filename: item.displayName });
      }
    }

    // 2) Free-text fallback if the structured payload yielded nothing.
    if (artifacts.length === 0) {
      const extracted = await this.comms.artifacts.extractArtifacts(input.sessionId, summary);
      summary = extracted.scrubbedText;
      artifacts.push(...extracted.artifacts);
    }

    // 3) One bounded recovery attempt when a file was clearly found but no
    //    artifact registered — never surface "unavailable" to the user first.
    if (artifacts.length === 0 && !ctx.recoveryUsed && looksLikeFileFind(result.summary)) {
      ctx.recoveryUsed = true;
      logArtifactStage({ turnId: ctx.turnId, taskId: result.taskId, stage: "recovery_attempt" });
      const recovered = await this.recoverArtifacts(input, ctx);
      artifacts.push(...recovered);
      if (recovered.length === 0) {
        return { ...result, summary, artifacts: [], artifactError: "artifact_not_returned" };
      }
    }

    return { ...result, summary, ...(artifacts.length > 0 ? { artifacts } : {}) };
  }

  private async recoverArtifacts(input: OrchestratorInput, ctx: TurnContext): Promise<Array<{ artifactId: string; displayName: string; mimeType: string; sizeBytes: number }>> {
    const request: ComputerTaskRequest = {
      sessionId: input.sessionId,
      computerId: input.computerId,
      instruction:
        "Return the exact absolute path of the file you already found as the required ARTIFACTS_JSON payload. " +
        "Do not search for a different file, and do not open any application.",
      allowedFolders: input.allowedFolders,
      allowedApplications: input.allowedApplications,
    };
    this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: "Capturing the file location", state: "current" });
    const result = await this.computer.run(request);
    const artifacts: Array<{ artifactId: string; displayName: string; mimeType: string; sizeBytes: number }> = [];
    for (const item of result.artifacts ?? []) {
      const outcome = await this.comms!.artifacts.registerWithReason(input.sessionId, item.localPath);
      if ("artifact" in outcome) artifacts.push(outcome.artifact);
    }
    if (artifacts.length === 0) {
      const extracted = await this.comms!.artifacts.extractArtifacts(input.sessionId, result.summary);
      artifacts.push(...extracted.artifacts);
    }
    logArtifactStage({ turnId: ctx.turnId, taskId: result.taskId, stage: "recovery_result", sizeBytes: artifacts.length });
    return artifacts;
  }

  private async runWhatsAppArtifactSend(call: ResponseFunctionToolCall, input: OrchestratorInput): Promise<ResponseInputItem> {
    let output: Record<string, unknown>;
    try {
      const args = parseArtifactSend(call.arguments);
      const record = await this.comms!.artifacts.resolveForDelivery(input.sessionId, args.artifactId);
      output = await this.deliverToWhatsApp(input, args.artifactId, record, args.caption ?? undefined, call.call_id);
    } catch (error) {
      output = errorOutput(error);
    }
    return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
  }

  // Deliver a resolved artifact to the owner's WhatsApp: native media when
  // Twilio supports the type, otherwise a single-use secure download link sent
  // as text. Never reports an unsupported file as native media.
  private async deliverToWhatsApp(
    input: OrchestratorInput,
    artifactId: string,
    record: { displayName: string; sizeBytes: number; mimeType: string },
    caption: string | undefined,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const published = await this.comms!.publisher.publishArtifact({ sessionId: input.sessionId, artifactId }).catch(() => {
      throw new ArtifactPipelineError("artifact_publish_failed");
    });
    try {
      if (isTwilioMediaSupported(record.mimeType)) {
        const sent = await this.whatsappSender!.sendWhatsAppMedia!({ mediaUrl: published.signedUrl, caption, idempotencyKey });
        this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: `Sent ${record.displayName} to your WhatsApp`, state: "done" });
        return { sid: sent.sid, status: sent.status, filename: record.displayName, sizeBytes: record.sizeBytes, delivery: "media" };
      }
      // Unsupported media type → deliver a secure, short-lived link as text.
      const body = `${caption ? `${caption}\n` : ""}Here's ${record.displayName}: ${published.signedUrl} (link expires in ~10 minutes)`;
      const sent = await this.whatsappSender!.sendWhatsAppText({ body, idempotencyKey });
      this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: `Sent a secure link to ${record.displayName}`, state: "done" });
      return { sid: sent.sid, status: sent.status, filename: record.displayName, sizeBytes: record.sizeBytes, delivery: "link" };
    } catch (error) {
      this.comms!.publisher.revokeArtifact(artifactId);
      throw error;
    }
  }

  private async runZipAndSend(call: ResponseFunctionToolCall, input: OrchestratorInput): Promise<ResponseInputItem> {
    let output: Record<string, unknown>;
    try {
      const args = parseZipAndSend(call.arguments);
      const zipped = await this.comms!.zip.zipArtifacts(input.sessionId, args.artifactIds, args.zipName ?? "files.zip");
      const record = await this.comms!.artifacts.resolveForDelivery(input.sessionId, zipped.artifactId);
      output = await this.deliverToWhatsApp(input, zipped.artifactId, record, args.caption ?? undefined, call.call_id);
    } catch (error) {
      output = errorOutput(error);
    }
    return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
  }

  private async runCommunication(call: ResponseFunctionToolCall, input: OrchestratorInput): Promise<ResponseInputItem> {
    let output: Record<string, unknown>;
    try {
      const args = parseCommunication(call.arguments);
      // Resolve an email self-reference ("me"/"myself"/owner address) to the
      // configured owner email so the To field is exact and self-sends can skip
      // the third-party approval step.
      const resolved = resolveRecipient(args.application, args.recipientOrDestination, this.ownerEmail);
      if (resolved.error) {
        output = { status: "failed", deliveryStatus: "failed", error: resolved.error };
        return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
      }
      const request: CommunicationRequest = {
        application: args.application,
        applicationName: args.applicationName,
        action: args.action,
        recipientOrDestination: resolved.recipient,
        message: args.message,
        subject: args.subject,
        sendMode: args.sendMode,
      };
      let attachmentPath: string | undefined;
      if (args.artifactId) {
        if (!this.comms) throw new Error("Attachments are not available");
        const record = await this.comms.artifacts.resolveForDelivery(input.sessionId, args.artifactId);
        request.attachmentName = record.displayName;
        request.attachmentPath = record.localPath;
        request.attachmentMime = record.mimeType;
        attachmentPath = record.localPath;
      }
      // Server-enforced approval: third-party/platform sends never reach the
      // desktop without a valid approval bound to this exact platform/
      // recipient/content/attachment. Sends to the owner's own email are exempt
      // (the owner explicitly asked to send to themselves).
      if (args.sendMode === "send" && !resolved.isOwnerSelf && !this.approvals.redeem(input.sessionId, args.approvalId, request)) {
        output = { status: "failed", deliveryStatus: "failed", error: "approval required or invalidated — create a draft first and confirm with the user" };
        return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
      }
      const instruction = buildCommunicationInstruction(request);
      this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: describeCommunication(request), state: "current" });
      const result = await this.computer.run({
        sessionId: input.sessionId,
        computerId: input.computerId,
        instruction,
        allowedFolders: input.allowedFolders,
        allowedApplications: input.allowedApplications,
      });
      const { attachmentStatus, deliveryStatus } = mapCommunicationOutcome(request, result.status, result.summary);
      const summary = scrubPaths(result.summary, attachmentPath, request.attachmentName ?? undefined);
      this.events.emit({ kind: "computer-action", sessionId: input.sessionId, label: summaryLabel(deliveryStatus, request), state: "done" });
      output = {
        status: deliveryStatus,
        deliveryStatus,
        attachmentStatus,
        application: request.application === "other" ? (request.applicationName ?? "other") : request.application,
        destination: request.recipientOrDestination,
        subject: request.subject ?? undefined,
        attachmentName: request.attachmentName ?? undefined,
        summary: summary.slice(0, 400),
        confirmationRequired: deliveryStatus === "draft_created",
      };
      if (deliveryStatus === "draft_created") output.approvalId = this.approvals.issue(input.sessionId, request);
    } catch (error) {
      output = { status: "failed", error: error instanceof Error ? error.message : "communication task failed" };
    }
    return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
  }

  // The output faithfully reports Twilio's verdict: {sid, status} only when
  // Twilio accepted the message, {error} otherwise — the model cannot claim a
  // send succeeded when it did not.
  private async runWhatsAppSend(call: ResponseFunctionToolCall): Promise<ResponseInputItem> {
    const message = parseWhatsappMessage(call.arguments);
    let output: Record<string, string>;
    try {
      const sent = await this.whatsappSender!.sendWhatsAppText({ body: message, idempotencyKey: call.call_id });
      output = { sid: sent.sid, status: sent.status };
    } catch (error) {
      output = { error: error instanceof Error ? error.message : "WhatsApp send failed" };
    }
    return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(output) };
  }

  // Fallback when the streaming request cannot be established.
  private async runNonStreaming(input: OrchestratorInput, ctx: TurnContext): Promise<OrchestratorResult> {
    let response = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM,
      input: input.text,
      previous_response_id: input.previousResponseId,
      tools: this.tools,
      store: true,
    });
    for (let turn = 0; turn < 6; turn += 1) {
      const calls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === "function_call");
      if (calls.length === 0) {
        turnMetrics.mark(input.sessionId, "openai-complete");
        return { responseId: response.id, text: response.output_text || "I’m ready for the next instruction." };
      }
      const outputs = await this.runToolCalls(calls, input, ctx);
      response = await this.client.responses.create({ model: this.model, previous_response_id: response.id, input: outputs, tools: this.tools, store: true });
    }
    throw new Error("Orchestrator exceeded the tool-turn limit");
  }
}

const FILE_FIND_RE = /\bfound\b|\blocated\b|\bon (?:your|the) desktop\b|\.(?:pdf|png|jpe?g|gif|docx?|xlsx?|pptx?|txt|csv|zip|mp[34]|m4a|mov)\b/i;

function looksLikeFileFind(summary: string): boolean {
  return FILE_FIND_RE.test(summary);
}

/** One concise error output for a delivery/artifact failure, carrying its code. */
function errorOutput(error: unknown): Record<string, unknown> {
  if (error instanceof ArtifactPipelineError) {
    return { status: "failed", code: error.code, error: ARTIFACT_ERROR_MESSAGE[error.code] };
  }
  return { status: "failed", error: error instanceof Error ? error.message : "delivery failed" };
}

function parseZipAndSend(raw: string): { artifactIds: string[]; zipName: string | null; caption: string | null } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("zip_and_send_whatsapp arguments were not valid JSON"); }
  const args = value as { artifactIds?: unknown; zipName?: unknown; caption?: unknown };
  const ids = Array.isArray(args?.artifactIds) ? args.artifactIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  if (ids.length === 0) throw new Error("zip_and_send_whatsapp requires at least one artifactId");
  return {
    artifactIds: ids,
    zipName: typeof args.zipName === "string" && args.zipName.trim() ? args.zipName.trim() : null,
    caption: typeof args.caption === "string" && args.caption.trim() ? args.caption.trim() : null,
  };
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

function parseArtifactSend(raw: string): { artifactId: string; caption: string | null } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("send_whatsapp_artifact arguments were not valid JSON"); }
  const args = value as { artifactId?: unknown; caption?: unknown };
  if (typeof args?.artifactId !== "string" || !args.artifactId.trim()) throw new Error("send_whatsapp_artifact requires an artifactId");
  const caption = typeof args.caption === "string" && args.caption.trim() ? args.caption.trim() : null;
  return { artifactId: args.artifactId.trim(), caption };
}

const COMMUNICATION_APPLICATIONS = new Set(["gmail", "slack", "linkedin", "discord", "whatsapp_web", "other"]);

function parseCommunication(raw: string): {
  application: CommunicationApplication;
  applicationName: string | null;
  action: string;
  recipientOrDestination: string;
  message: string | null;
  subject: string | null;
  artifactId: string | null;
  sendMode: SendMode;
  approvalId: string | null;
} {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("communicate_via_computer arguments were not valid JSON"); }
  const args = value as Record<string, unknown>;
  const application = typeof args.application === "string" ? args.application : "";
  if (!COMMUNICATION_APPLICATIONS.has(application)) throw new Error("communicate_via_computer requires a supported application");
  const action = typeof args.action === "string" ? args.action.trim() : "";
  const destination = typeof args.recipientOrDestination === "string" ? args.recipientOrDestination.trim() : "";
  if (!action || !destination) throw new Error("communicate_via_computer requires an action and a recipientOrDestination");
  const sendMode = args.sendMode === "send" ? "send" : args.sendMode === "draft" ? "draft" : null;
  if (!sendMode) throw new Error("communicate_via_computer sendMode must be 'draft' or 'send'");
  return {
    application: application as CommunicationApplication,
    applicationName: optionalText(args.applicationName),
    action,
    recipientOrDestination: destination,
    message: optionalText(args.message),
    subject: optionalText(args.subject),
    artifactId: optionalText(args.artifactId),
    sendMode,
    approvalId: optionalText(args.approvalId),
  };
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Local paths never travel back to the model or the transcript. */
function scrubPaths(text: string, attachmentPath?: string, attachmentName?: string): string {
  let scrubbed = text;
  if (attachmentPath) scrubbed = scrubbed.split(attachmentPath).join(attachmentName ?? "[attached file]");
  return scrubbed.replace(/\/(?:Users|home)\/[^\s"'`)\]]+/g, "[local file]");
}

const SELF_REFERENCES = new Set(["me", "myself", "my email", "self", "my own email", "my inbox", "my account"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Resolve an email self-reference to the configured owner address. */
function resolveRecipient(
  application: CommunicationApplication,
  raw: string,
  ownerEmail?: string,
): { recipient: string; isOwnerSelf: boolean; error?: string } {
  const value = raw.trim();
  const emailLike = application === "gmail" || (application === "other" && (EMAIL_RE.test(value) || SELF_REFERENCES.has(value.toLowerCase())));
  if (!emailLike) return { recipient: value, isOwnerSelf: false };
  const isSelfReference = SELF_REFERENCES.has(value.toLowerCase());
  const matchesOwner = Boolean(ownerEmail) && value.toLowerCase() === ownerEmail!.toLowerCase();
  if (isSelfReference || matchesOwner) {
    if (!ownerEmail) return { recipient: value, isOwnerSelf: false, error: "owner email is not configured (set KYLIAN_OWNER_EMAIL)" };
    return { recipient: ownerEmail, isOwnerSelf: true };
  }
  return { recipient: value, isOwnerSelf: false };
}

function describeCommunication(request: CommunicationRequest): string {
  const app = request.application === "other" ? (request.applicationName ?? "the requested app") : request.application;
  const verb = request.sendMode === "send" ? "Sending" : "Drafting";
  return `${verb} a message in ${app} for ${request.recipientOrDestination}`;
}

function summaryLabel(status: string, request: CommunicationRequest): string {
  const app = request.application === "other" ? (request.applicationName ?? "the requested app") : request.application;
  switch (status) {
    case "sent": return `Message sent via ${app} to ${request.recipientOrDestination}`;
    case "draft_created": return `Draft ready in ${app} for ${request.recipientOrDestination} — awaiting approval`;
    case "blocked": return `${app} needs a login before Kylian can continue`;
    case "unknown": return `The ${app} send finished without a visible confirmation`;
    default: return `The ${app} task did not complete`;
  }
}

function parseWhatsappMessage(raw: string): string {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("send_whatsapp_message arguments were not valid JSON"); }
  if (!value || typeof value !== "object" || typeof (value as { message?: unknown }).message !== "string") {
    throw new Error("send_whatsapp_message requires a message string");
  }
  const message = (value as { message: string }).message.trim();
  if (!message) throw new Error("send_whatsapp_message message cannot be empty");
  return message;
}
