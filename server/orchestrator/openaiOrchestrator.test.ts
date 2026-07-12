import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { ComputerTaskAdapter } from "../computer/types.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { OpenAIOrchestrator, SYSTEM, TOOL_ACKNOWLEDGEMENT } from "./openaiOrchestrator.js";

test("system prompt frames Kylian as a remote personal assistant, not a task bot", () => {
  assert.match(SYSTEM, /remote personal computer assistant/);
  assert.match(SYSTEM, /one or two short sentences/);
  assert.match(SYSTEM, /only when inspecting or changing the computer is genuinely required/);
  assert.match(SYSTEM, /Never claim an action succeeded unless the executor confirms it/);
  assert.match(SYSTEM, /Lead with the useful answer/);
  assert.match(SYSTEM, /Do not mention Twilio, Gradium/);
  assert.match(SYSTEM, /repeat the numbers back and ask the user to confirm/);
  assert.match(SYSTEM, /Never silently send ambiguous numbers/);
  assert.match(SYSTEM, /Do not write shell commands or scripts in the instruction/);
});

test("system prompt forbids repeated self-introductions after the runtime greeting", () => {
  assert.match(SYSTEM, /Do not introduce yourself unless this is the first greeting or the user directly asks who you are/);
  assert.match(SYSTEM, /Never begin ordinary responses with "Hi, I'm Kylian,"/);
  assert.match(SYSTEM, /The initial greeting is handled separately by the voice runtime\. Do not generate another greeting or self-introduction during the conversation\./);
  assert.match(SYSTEM, /Do not repeat your capabilities unless the user asks what you can do/);
  assert.match(SYSTEM, /Do not restate the user's request before answering/);
  assert.match(SYSTEM, /it is not text to repeat aloud/);
});

test("tool acknowledgements stay brief and do not reintroduce Kylian", () => {
  assert.ok(!TOOL_ACKNOWLEDGEMENT.includes("Kylian"));
  assert.ok(TOOL_ACKNOWLEDGEMENT.length < 40);
});

test("conversational questions stream speech phrases and never call computer_task", async () => {
  for (const question of ["What can you help me with?", "Can you hear me?", "Explain what a PDF is"]) {
    const events = new RuntimeEventHub();
    const speech = captureSpeech(events);
    const answer = "I can find files and answer questions. What do you need?";
    const client = new FakeStreamingOpenAI([[...deltas(answer), completed("resp-1")]]);
    const computer = new RecordingComputer();
    const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", computer, events);
    const result = await orchestrator.run(input(question, "resp-0"));
    assert.equal(computer.instructions.length, 0, `${question} must not invoke computer_task`);
    assert.equal(result.spoken, true);
    assert.equal(result.responseId, "resp-1");
    assert.equal(speech.join(" "), answer);
    assert.ok(speech.length >= 2, "long answers stream as multiple phrases");
    assert.equal(client.calls[0].instructions, SYSTEM);
    assert.equal(client.calls[0].previous_response_id, "resp-0");
    assert.equal(client.calls[0].stream, true);
  }
});

test("the first phrase is spoken before the OpenAI response completes", async () => {
  const events = new RuntimeEventHub();
  const speech = captureSpeech(events);
  let speechCountWhenCompleted = -1;
  const stream = async function* () {
    yield* deltas("That file lives in your Documents folder. Want me to open it?");
    speechCountWhenCompleted = speech.length;
    yield completed("resp-1");
  };
  const client = { calls: [] as unknown[], responses: { create: async (args: unknown) => { (client.calls as unknown[]).push(args); return stream(); } } };
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", new RecordingComputer(), events);
  await orchestrator.run(input("Where is my report?"));
  assert.ok(speechCountWhenCompleted >= 1, "at least one phrase must be spoken before completion");
});

test("computer inspection requests invoke the tool with a neutral ack and only verified results are spoken", async () => {
  for (const request of ["Where is my resume file?", "Open my Downloads folder"]) {
    const events = new RuntimeEventHub();
    const speech = captureSpeech(events);
    const call = functionCall("call-1", "Search the computer");
    const client = new FakeStreamingOpenAI([
      [...deltas("I opened it"), { type: "response.output_item.added", item: call }, completed("resp-1", [call])],
      [...deltas("Found it. It is in your Documents folder."), completed("resp-2")],
    ]);
    const computer = new RecordingComputer();
    const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", computer, events);
    const result = await orchestrator.run(input(request));
    assert.deepEqual(computer.instructions, ["Search the computer"], `${request} must invoke computer_task`);
    assert.equal(speech[0], TOOL_ACKNOWLEDGEMENT, "a neutral acknowledgement is spoken before the tool runs");
    assert.ok(!speech.some((text) => text.includes("I opened it")), "unverified pre-tool text is never spoken");
    assert.equal(speech.join(" ").includes("Found it."), true, "the verified result is spoken after the tool");
    assert.equal((client.calls[1] as { previous_response_id?: string }).previous_response_id, "resp-1");
    const continuation = (client.calls[1] as { input?: Array<{ type?: string; output?: string }> }).input ?? [];
    const toolOutput = continuation.find((item) => item.type === "function_call_output");
    assert.ok(toolOutput, "the executor result is returned via function_call_output");
    assert.match(toolOutput.output ?? "", /"summary":"Done"/, "OpenAI receives the executor's final answer");
    assert.equal(result.responseId, "resp-2");
    assert.equal(result.spoken, true);
  }
});

test("falls back to the non-streaming Responses API when streaming cannot start", async () => {
  const events = new RuntimeEventHub();
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    responses: {
      create: async (args: Record<string, unknown>) => {
        calls.push(args);
        if (args.stream) throw new Error("streaming unsupported");
        return { id: "resp-plain", output: [], output_text: "Hello there." };
      },
    },
  };
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", new RecordingComputer(), events);
  const result = await orchestrator.run(input("Hi", "resp-9"));
  assert.deepEqual({ responseId: result.responseId, text: result.text, spoken: result.spoken ?? false }, { responseId: "resp-plain", text: "Hello there.", spoken: false });
  assert.equal(calls[1].stream, undefined);
  assert.equal(calls[1].instructions, SYSTEM);
  assert.equal(calls[1].previous_response_id, "resp-9");
});

test("send_whatsapp_message is declared only when a sender is configured and reports Twilio's verdict", async () => {
  const events = new RuntimeEventHub();
  const sender = new RecordingWhatsAppSender();
  const call = whatsappCall("call-wa", "Dinner at 8?");
  const client = new FakeStreamingOpenAI([
    [{ type: "response.output_item.added", item: call }, completed("resp-1", [call])],
    [...deltas("Sent it."), completed("resp-2")],
  ]);
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", new RecordingComputer(), events, sender);
  const result = await orchestrator.run(input("Send a WhatsApp message saying Dinner at 8?"));

  assert.deepEqual((client.calls[0] as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name), ["computer_task", "communicate_via_computer", "send_whatsapp_message"]);
  assert.deepEqual(sender.sent, [{ body: "Dinner at 8?", idempotencyKey: "call-wa" }]);
  const continuation = (client.calls[1] as { input: Array<{ type?: string; output?: string }> }).input;
  const toolOutput = continuation.find((item) => item.type === "function_call_output");
  assert.ok(toolOutput);
  assert.deepEqual(JSON.parse(toolOutput.output ?? "{}"), { sid: "SM1", status: "queued" });
  assert.equal(result.responseId, "resp-2");
});

test("a Twilio failure is reported to OpenAI as an error output, never as success", async () => {
  const events = new RuntimeEventHub();
  const sender = new RecordingWhatsAppSender();
  sender.failWith = new Error("Twilio WhatsApp send failed: 401");
  const call = whatsappCall("call-wa", "hello");
  const client = new FakeStreamingOpenAI([
    [{ type: "response.output_item.added", item: call }, completed("resp-1", [call])],
    [...deltas("I could not send it."), completed("resp-2")],
  ]);
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", new RecordingComputer(), events, sender);
  await orchestrator.run(input("send a whatsapp"));
  const continuation = (client.calls[1] as { input: Array<{ type?: string; output?: string }> }).input;
  const toolOutput = continuation.find((item) => item.type === "function_call_output");
  const payload = JSON.parse(toolOutput?.output ?? "{}");
  assert.match(payload.error, /Twilio WhatsApp send failed/);
  assert.equal(payload.sid, undefined);
});

test("without a sender the WhatsApp tool is not declared and unknown tools still throw", async () => {
  const events = new RuntimeEventHub();
  const client = new FakeStreamingOpenAI([[...deltas("Hello."), completed("resp-1")]]);
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt-test", new RecordingComputer(), events);
  await orchestrator.run(input("hi"));
  assert.deepEqual((client.calls[0] as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name), ["computer_task", "communicate_via_computer"]);

  const rogue = whatsappCall("call-x", "hi");
  const client2 = new FakeStreamingOpenAI([[{ type: "response.output_item.added", item: rogue }, completed("resp-1", [rogue])]]);
  const orchestrator2 = new OpenAIOrchestrator(client2 as unknown as OpenAI, "gpt-test", new RecordingComputer(), events);
  await assert.rejects(() => orchestrator2.run(input("hi")), /Unsupported tool: send_whatsapp_message/);
});

test("system prompt restricts WhatsApp sending to explicit user requests", () => {
  assert.match(SYSTEM, /Only send a WhatsApp message when the user explicitly asks/);
  assert.match(SYSTEM, /never invent recipients/);
});

test("system prompt encodes the two-path communication routing rules", () => {
  assert.match(SYSTEM, /WhatsApp delivery to the owner uses the Twilio tools/);
  assert.match(SYSTEM, /Gmail, Slack, LinkedIn, Discord, websites, WhatsApp Web, and every other app use communicate_via_computer/);
  assert.match(SYSTEM, /ask which application or website/);
  assert.match(SYSTEM, /ask "WhatsApp or email\?"/);
  assert.match(SYSTEM, /prefer WhatsApp when it is available/);
  assert.match(SYSTEM, /a draft is "ready to send", never "sent"/);
  assert.match(SYSTEM, /Use Twilio \(not WhatsApp Web\) for the owner's own WhatsApp/);
  assert.match(SYSTEM, /use send_whatsapp_artifact \(Twilio\)\. Never use WhatsApp Web or communicate_via_computer for owner file delivery/);
  assert.match(SYSTEM, /an explicit email\/send verb to the owner's own address authorizes the send/);
  assert.match(SYSTEM, /Never use computer_task to open Mail\.app/);
  assert.match(SYSTEM, /report the file's full absolute path/);
});

function whatsappCall(callId: string, message: string) {
  return { type: "function_call", id: `fc-${callId}`, call_id: callId, name: "send_whatsapp_message", arguments: JSON.stringify({ message }), status: "completed" };
}

class RecordingWhatsAppSender {
  sent: Array<{ to?: string; body: string; idempotencyKey?: string }> = [];
  failWith?: Error;
  async sendWhatsAppText(request: { to?: string; body: string; idempotencyKey?: string }) {
    if (this.failWith) throw this.failWith;
    this.sent.push(request);
    return { sid: `SM${this.sent.length}`, status: "queued" };
  }
}

function input(text: string, previousResponseId?: string) {
  return { sessionId: "session-1", computerId: "demo-computer", text, allowedFolders: [], allowedApplications: [], previousResponseId };
}

function captureSpeech(events: RuntimeEventHub): string[] {
  const speech: string[] = [];
  events.subscribe("session-1", ({ event }) => { if (event.kind === "agent-speech") speech.push(event.text); });
  return speech;
}

function deltas(text: string, size = 7): Array<{ type: string; delta: string }> {
  const parts: Array<{ type: string; delta: string }> = [];
  for (let index = 0; index < text.length; index += size) parts.push({ type: "response.output_text.delta", delta: text.slice(index, index + size) });
  return parts;
}

function completed(id: string, output: unknown[] = []) {
  return { type: "response.completed", response: { id, output, output_text: "" } };
}

function functionCall(callId: string, instruction: string) {
  return { type: "function_call", id: "fc-1", call_id: callId, name: "computer_task", arguments: JSON.stringify({ instruction }), status: "completed" };
}

class FakeStreamingOpenAI {
  calls: Array<Record<string, unknown>> = [];
  constructor(private readonly turns: unknown[][]) {}
  responses = {
    create: async (args: Record<string, unknown>) => {
      this.calls.push(args);
      const events = this.turns[this.calls.length - 1] ?? [];
      return (async function* () { yield* events; })();
    },
  };
}

class RecordingComputer implements ComputerTaskAdapter {
  readonly provider = "mock" as const;
  instructions: string[] = [];
  async run(request: { instruction: string }) {
    this.instructions.push(request.instruction);
    return { taskId: "task-1", status: "completed" as const, summary: "Done" };
  }
  async steer(): Promise<void> {}
  async pause(): Promise<void> {}
  async stop(): Promise<void> {}
}
