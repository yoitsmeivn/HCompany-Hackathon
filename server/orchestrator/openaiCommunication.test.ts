import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type OpenAI from "openai";
import type { ComputerTaskAdapter } from "../computer/types.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { ArtifactStore } from "../artifacts/artifactStore.js";
import { ArtifactPublisher } from "../artifacts/artifactPublisher.js";
import { ZipService } from "../artifacts/zipService.js";
import { OpenAIOrchestrator } from "./openaiOrchestrator.js";

const BASE = "https://tunnel.example.com";

function completed(id: string, output: unknown[] = []) {
  return { type: "response.completed", response: { id, output, output_text: "" } };
}
function textDeltas(text: string) {
  return [{ type: "response.output_text.delta", delta: text }];
}
function toolCall(callId: string, name: string, args: Record<string, unknown>) {
  return { type: "function_call", id: `fc-${callId}`, call_id: callId, name, arguments: JSON.stringify(args), status: "completed" };
}

/** A fake OpenAI client whose per-turn script can be reset between runs, so a
 * single orchestrator instance (with its persistent approval registry) can
 * drive a draft turn and then a send turn. */
class ResettableOpenAI {
  calls: Array<Record<string, unknown>> = [];
  private turns: unknown[][] = [];
  script(turns: unknown[][]): void {
    this.turns = turns;
    this.calls = [];
  }
  /** The function_call_output the orchestrator returned to OpenAI on turn 2. */
  toolOutput(): Record<string, unknown> {
    const items = (this.calls[1] as { input: Array<{ type?: string; output?: string }> }).input;
    const output = items.find((item) => item.type === "function_call_output")?.output ?? "{}";
    return JSON.parse(output);
  }
  responses = {
    create: async (args: Record<string, unknown>) => {
      this.calls.push(args);
      const events = this.turns[this.calls.length - 1] ?? [];
      return (async function* () { yield* events; })();
    },
  };
}

class ScriptedComputer implements ComputerTaskAdapter {
  readonly provider = "mock" as const;
  instructions: string[] = [];
  summary = "Done";
  status: "completed" | "failed" = "completed";
  // Optional scripted responses returned in order (for multi-task flows like recovery).
  responses?: Array<{ summary: string; artifacts?: Array<{ localPath: string; displayName: string }> }>;
  private index = 0;
  async run(request: { instruction: string }) {
    this.instructions.push(request.instruction);
    if (this.responses) {
      const next = this.responses[Math.min(this.index++, this.responses.length - 1)];
      return { taskId: `t${this.index}`, status: "completed" as const, summary: next.summary, ...(next.artifacts ? { artifacts: next.artifacts } : {}) };
    }
    return { taskId: "t", status: this.status, summary: this.summary };
  }
  async steer(): Promise<void> {}
  async pause(): Promise<void> {}
  async stop(): Promise<void> {}
}

class FakeWhatsApp {
  media: Array<{ mediaUrl: string; caption?: string }> = [];
  texts: string[] = [];
  async sendWhatsAppText(input: { body: string }) {
    this.texts.push(input.body);
    return { sid: "SMtext", status: "queued" };
  }
  async sendWhatsAppMedia(input: { mediaUrl: string; caption?: string }) {
    this.media.push({ mediaUrl: input.mediaUrl, caption: input.caption });
    return { sid: "SMmedia", status: "queued" };
  }
}

async function comms() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-comm-"));
  const file = path.join(root, "IvanResume.pdf");
  await fs.writeFile(file, Buffer.alloc(2048, 1));
  const artifacts = new ArtifactStore([root], 15_000_000);
  const publisher = new ArtifactPublisher(artifacts, BASE);
  const zip = new ZipService(artifacts);
  return { artifacts, publisher, zip, file, deps: { artifacts, publisher, zip } };
}

function input(text: string) {
  return { sessionId: "session-1", computerId: "demo-computer", text, allowedFolders: [], allowedApplications: [] };
}

function draftThenReply(call: unknown, reply: string): unknown[][] {
  return [
    [{ type: "response.output_item.added", item: call }, completed("resp-1", [call])],
    [...textDeltas(reply), completed("resp-2")],
  ];
}

test("computer_task exposes located files as artifacts, never raw paths", async () => {
  const { file, deps } = await comms();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "computer_task", { instruction: "find my resume" });
  client.script(draftThenReply(call, "Found it."));
  const computer = new ScriptedComputer();
  computer.summary = `I found the file at ${file} and stopped.`;
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);
  await orchestrator.run(input("find my resume"));

  const payload = client.toolOutput();
  assert.equal((payload.artifacts as unknown[]).length, 1);
  assert.equal((payload.artifacts as Array<{ displayName: string }>)[0].displayName, "IvanResume.pdf");
  assert.ok(!JSON.stringify(payload).includes(file), "the raw local path is never sent to the model");
});

test("structured artifacts register without relying on prose scanning", async () => {
  const { file, deps } = await comms();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "computer_task", { instruction: "find my resume" });
  client.script(draftThenReply(call, "Found it."));
  const computer = new ScriptedComputer();
  // Prose has NO path — only the structured artifacts field carries it.
  computer.responses = [{ summary: "I found your resume.", artifacts: [{ localPath: file, displayName: "IvanResume.pdf" }] }];
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);
  await orchestrator.run(input("find my resume"));
  const payload = client.toolOutput();
  assert.equal((payload.artifacts as unknown[]).length, 1);
  assert.equal((payload.artifacts as Array<{ displayName: string }>)[0].displayName, "IvanResume.pdf");
});

test("a found-but-unregistered file triggers exactly one recovery that then delivers", async () => {
  const { file, deps } = await comms();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "computer_task", { instruction: "find my resume" });
  client.script(draftThenReply(call, "Found it."));
  const computer = new ScriptedComputer();
  // First task: found a file but no path/artifact. Recovery task: returns the structured path.
  computer.responses = [
    { summary: "I found your resume on the Desktop." },
    { summary: "Here is the path.", artifacts: [{ localPath: file, displayName: "IvanResume.pdf" }] },
  ];
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);
  await orchestrator.run(input("find my resume"));
  assert.equal(computer.instructions.length, 2, "exactly one recovery attempt");
  assert.match(computer.instructions[1], /Return the exact absolute path/);
  const payload = client.toolOutput();
  assert.equal((payload.artifacts as unknown[]).length, 1, "recovery produced a usable artifact — no user-facing failure");
});

test("recovery failure yields one precise error code, not a repeated dead-end", async () => {
  const { deps } = await comms();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "computer_task", { instruction: "find my resume" });
  client.script(draftThenReply(call, "Found it."));
  const computer = new ScriptedComputer();
  computer.responses = [
    { summary: "I found your resume on the Desktop." },
    { summary: "I could not capture the path." },
  ];
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);
  await orchestrator.run(input("find my resume"));
  const payload = client.toolOutput();
  assert.equal(payload.artifactError, "artifact_not_returned");
  assert.equal((payload.artifacts as unknown[]).length, 0);
});

test("an unsupported file type is delivered as a secure link, not native media", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-comm-"));
  const txt = path.join(root, "notes.txt");
  await fs.writeFile(txt, "hello");
  const artifacts = new ArtifactStore([root], 15_000_000);
  const publisher = new ArtifactPublisher(artifacts, BASE);
  const deps = { artifacts, publisher, zip: new ZipService(artifacts) };
  const summary = await artifacts.register("session-1", txt);
  const whatsapp = new FakeWhatsApp();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "send_whatsapp_artifact", { artifactId: summary!.artifactId, caption: null });
  client.script(draftThenReply(call, "Sent."));
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", new ScriptedComputer(), new RuntimeEventHub(), whatsapp, deps);
  await orchestrator.run(input("whatsapp me my notes"));
  assert.equal(whatsapp.media.length, 0, "unsupported type never sent as media");
  assert.equal(whatsapp.texts.length, 1, "delivered as a text link instead");
  assert.match(whatsapp.texts[0], /notes\.txt/);
  assert.match(whatsapp.texts[0], /https:\/\/tunnel\.example\.com\/api\/artifacts\//);
  const payload = client.toolOutput();
  assert.equal(payload.delivery, "link");
});

test("zip_and_send_whatsapp bundles multiple files and delivers them", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kylian-comm-"));
  const a = path.join(root, "a.pdf");
  const b = path.join(root, "b.txt");
  await fs.writeFile(a, Buffer.alloc(500, 1));
  await fs.writeFile(b, "text");
  const artifacts = new ArtifactStore([root], 15_000_000);
  const deps = { artifacts, publisher: new ArtifactPublisher(artifacts, BASE), zip: new ZipService(artifacts) };
  const idA = (await artifacts.register("session-1", a))!.artifactId;
  const idB = (await artifacts.register("session-1", b))!.artifactId;
  const whatsapp = new FakeWhatsApp();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "zip_and_send_whatsapp", { artifactIds: [idA, idB], zipName: "docs.zip", caption: null });
  client.script(draftThenReply(call, "Zipped."));
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", new ScriptedComputer(), new RuntimeEventHub(), whatsapp, deps);
  await orchestrator.run(input("zip these and whatsapp them"));
  const payload = client.toolOutput();
  assert.equal(payload.filename, "docs.zip");
  // application/zip is not native WhatsApp media, so it goes as a secure link.
  assert.equal(payload.delivery, "link");
  assert.equal(whatsapp.texts.length, 1);
  assert.match(whatsapp.texts[0], /docs\.zip/);
});

test("send_whatsapp_artifact publishes a signed URL and returns sid + filename with no path leak", async () => {
  const { artifacts, file, deps } = await comms();
  const summary = await artifacts.register("session-1", file);
  const whatsapp = new FakeWhatsApp();
  const client = new ResettableOpenAI();
  const call = toolCall("c1", "send_whatsapp_artifact", { artifactId: summary!.artifactId, caption: "Your resume" });
  client.script(draftThenReply(call, "Sent."));
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", new ScriptedComputer(), new RuntimeEventHub(), whatsapp, deps);
  await orchestrator.run(input("whatsapp me my resume"));

  assert.equal(whatsapp.media.length, 1);
  assert.match(whatsapp.media[0].mediaUrl, /^https:\/\/tunnel\.example\.com\/api\/artifacts\/[a-f0-9]{64}$/);
  const payload = client.toolOutput();
  assert.equal(payload.sid, "SMmedia");
  assert.equal(payload.filename, "IvanResume.pdf");
  assert.ok(!JSON.stringify(payload).includes(file), "no local path in the model output");
  assert.ok(!JSON.stringify(payload).includes("/api/artifacts/"), "no signed URL in the model output");
});

test("a draft issues an approvalId and an unapproved send never reaches the desktop", async () => {
  const deps = await comms();
  const computer = new ScriptedComputer();
  computer.summary = "Draft created in Gmail";
  const client = new ResettableOpenAI();
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);

  const draftCall = toolCall("c1", "communicate_via_computer", {
    application: "gmail", applicationName: null, action: "Create a new email draft", recipientOrDestination: "me@example.com",
    message: "Here is my resume", subject: "Resume", artifactId: null, sendMode: "draft", approvalId: null,
  });
  client.script(draftThenReply(draftCall, "Draft ready."));
  await orchestrator.run(input("draft an email to me"));
  const draftOutput = client.toolOutput();
  assert.equal(draftOutput.status, "draft_created");
  assert.equal(draftOutput.confirmationRequired, true);
  assert.ok(draftOutput.approvalId);

  const drafts = computer.instructions.length;
  const badSend = toolCall("c2", "communicate_via_computer", {
    application: "gmail", applicationName: null, action: "Send the draft", recipientOrDestination: "me@example.com",
    message: "Here is my resume", subject: "Resume", artifactId: null, sendMode: "send", approvalId: "apv-bogus",
  });
  computer.summary = "The email was sent";
  client.script(draftThenReply(badSend, "done"));
  await orchestrator.run(input("send it"));
  const badOutput = client.toolOutput();
  assert.equal(badOutput.status, "failed");
  assert.match(String(badOutput.error), /approval required/);
  assert.equal(computer.instructions.length, drafts, "an unapproved send never reaches the desktop");
});

test("an explicit email to the owner's own address sends without a separate approval", async () => {
  const deps = await comms();
  const computer = new ScriptedComputer();
  computer.summary = "Composed the email to owner@example.com. The message was sent.";
  const client = new ResettableOpenAI();
  const orchestrator = new OpenAIOrchestrator(
    client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps, "owner@example.com",
  );
  const sendCall = toolCall("c1", "communicate_via_computer", {
    application: "gmail", applicationName: null, action: "Email my note", recipientOrDestination: "me",
    message: "hello", subject: "Note", artifactId: null, sendMode: "send", approvalId: null,
  });
  client.script(draftThenReply(sendCall, "sent"));
  await orchestrator.run(input("email this to me"));
  const output = client.toolOutput();
  assert.equal(output.deliveryStatus, "sent", "owner self-send is authorized by the explicit send verb");
  assert.equal(output.destination, "owner@example.com", "the self-reference resolved to the configured owner email");
  assert.equal(computer.instructions.length, 1, "the send reached the desktop");
});

test("a third-party email send still requires an approval", async () => {
  const deps = await comms();
  const computer = new ScriptedComputer();
  const client = new ResettableOpenAI();
  const orchestrator = new OpenAIOrchestrator(
    client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps, "owner@example.com",
  );
  const sendCall = toolCall("c1", "communicate_via_computer", {
    application: "gmail", applicationName: null, action: "Email Sophia", recipientOrDestination: "sophia@corp.com",
    message: "hi", subject: "Hi", artifactId: null, sendMode: "send", approvalId: null,
  });
  client.script(draftThenReply(sendCall, "sent"));
  await orchestrator.run(input("send this to sophia"));
  const output = client.toolOutput();
  assert.equal(output.status, "failed");
  assert.match(String(output.error), /approval required/);
  assert.equal(computer.instructions.length, 0, "an unapproved third-party send never reaches the desktop");
});

test("the matching approvalId lets the send reach the desktop and maps to sent", async () => {
  const deps = await comms();
  const computer = new ScriptedComputer();
  computer.summary = "Draft prepared in Slack";
  const client = new ResettableOpenAI();
  const orchestrator = new OpenAIOrchestrator(client as unknown as OpenAI, "gpt", computer, new RuntimeEventHub(), new FakeWhatsApp(), deps);

  const draftFields = {
    application: "slack", applicationName: null, action: "Draft a message", recipientOrDestination: "#demo",
    message: "Demo is ready", subject: null, artifactId: null,
  };
  const draftCall = toolCall("c1", "communicate_via_computer", { ...draftFields, sendMode: "draft", approvalId: null });
  client.script(draftThenReply(draftCall, "draft"));
  await orchestrator.run(input("draft slack to #demo"));
  const approvalId = client.toolOutput().approvalId as string;
  assert.ok(approvalId);

  computer.summary = "The message was sent to #demo";
  const sendCall = toolCall("c2", "communicate_via_computer", { ...draftFields, sendMode: "send", approvalId });
  client.script(draftThenReply(sendCall, "sent"));
  const before = computer.instructions.length;
  await orchestrator.run(input("send it"));
  const output = client.toolOutput();
  assert.equal(output.status, "sent");
  assert.equal(computer.instructions.length, before + 1, "the approved send reaches the desktop exactly once");
});
