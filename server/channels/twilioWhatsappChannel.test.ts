import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { loadConfig } from "../config.js";
import type { OrchestratorInput, OrchestratorResult } from "../orchestrator/types.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { PolicyStore } from "../runtime/policyStore.js";
import { twilioWhatsappInbound } from "./twilioWhatsappChannel.js";

const SELF = "whatsapp:+14158252791";
const SANDBOX = "whatsapp:+14155238886";

const env = {
  KYLIAN_VOICE_COMPUTER_ID: "demo-computer",
  KYLIAN_WHATSAPP_ENABLED: "true",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret-token",
  TWILIO_WHATSAPP_FROM: SANDBOX,
  KYLIAN_WHATSAPP_DEFAULT_TO: SELF,
  TWILIO_MEDIA_STREAM_URL: "wss://tunnel.example.com/twilio/media-stream",
  OPENAI_API_KEY: "sk-test",
};

class RecordingSessions {
  inputs: OrchestratorInput[] = [];
  private resolvers: Array<(result: OrchestratorResult) => void> = [];
  reply = "Reply from Kylian";
  autoResolve = true;

  handle = (input: OrchestratorInput): Promise<OrchestratorResult> => {
    this.inputs.push(input);
    if (this.autoResolve) return Promise.resolve({ text: this.reply });
    return new Promise((resolve) => this.resolvers.push(resolve));
  };

  resolveAll(): void {
    for (const resolve of this.resolvers.splice(0)) resolve({ text: this.reply });
  }
}

class RecordingSender {
  sent: Array<{ to?: string; body: string; idempotencyKey?: string }> = [];
  async sendWhatsAppText(input: { to?: string; body: string; idempotencyKey?: string }) {
    this.sent.push(input);
    return { sid: `SM${this.sent.length}`, status: "queued" };
  }
}

function buildApp(sessions: RecordingSessions, sender: RecordingSender) {
  const config = loadConfig({ ...env });
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.post(
    "/api/twilio/whatsapp",
    twilioWhatsappInbound(config, sessions as unknown as SessionOrchestrationService, new PolicyStore(), sender),
  );
  return app;
}

async function withServer(app: express.Express, run: (base: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  };
}

const VALID = { MessageSid: "SM100", From: SELF, To: SANDBOX, Body: "hello Kylian" };

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test("parses Twilio form fields into an OpenAI-brain orchestration call and replies via the sender", async () => {
  const sessions = new RecordingSessions();
  const sender = new RecordingSender();
  await withServer(buildApp(sessions, sender), async (base) => {
    const response = await fetch(`${base}/api/twilio/whatsapp`, form(VALID));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/xml/);
    assert.match(await response.text(), /<Response\/>/);
    await settle();
    assert.equal(sessions.inputs.length, 1);
    const input = sessions.inputs[0];
    assert.equal(input.sessionId, `twilio-whatsapp:${SELF}`);
    assert.equal(input.text, "hello Kylian");
    assert.equal(input.computerId, "demo-computer");
    assert.equal(input.channel, "voice", "WhatsApp deliberately uses the OpenAI brain");
    assert.deepEqual(sender.sent, [{ to: SELF, body: "Reply from Kylian", idempotencyKey: "reply:SM100" }]);
  });
});

test("responds fast with TwiML before orchestration resolves", async () => {
  const sessions = new RecordingSessions();
  sessions.autoResolve = false;
  const sender = new RecordingSender();
  await withServer(buildApp(sessions, sender), async (base) => {
    const response = await fetch(`${base}/api/twilio/whatsapp`, form(VALID));
    assert.equal(response.status, 200, "webhook acknowledged while the orchestrator is still pending");
    await settle();
    assert.equal(sender.sent.length, 0, "no reply sent yet");
    sessions.resolveAll();
    await settle();
    assert.equal(sender.sent.length, 1, "reply sent after the orchestrator resolved");
  });
});

test("rejects missing or non-whatsapp From/To fields", async () => {
  const sessions = new RecordingSessions();
  const sender = new RecordingSender();
  await withServer(buildApp(sessions, sender), async (base) => {
    for (const fields of [
      { ...VALID, From: "+14158252791" },
      { ...VALID, To: "+14155238886" },
      { MessageSid: "", From: SELF, To: SANDBOX, Body: "x" },
    ]) {
      const response = await fetch(`${base}/api/twilio/whatsapp`, form(fields));
      assert.equal(response.status, 400);
    }
    assert.equal(sessions.inputs.length, 0);
  });
});

test("rejects senders other than the configured self recipient", async () => {
  const sessions = new RecordingSessions();
  const sender = new RecordingSender();
  await withServer(buildApp(sessions, sender), async (base) => {
    const response = await fetch(`${base}/api/twilio/whatsapp`, form({ ...VALID, From: "whatsapp:+19998887777" }));
    assert.equal(response.status, 403);
    await settle();
    assert.equal(sessions.inputs.length, 0);
    assert.equal(sender.sent.length, 0);
  });
});

test("deduplicates by MessageSid across Twilio retries", async () => {
  const sessions = new RecordingSessions();
  const sender = new RecordingSender();
  await withServer(buildApp(sessions, sender), async (base) => {
    const first = await fetch(`${base}/api/twilio/whatsapp`, form(VALID));
    const retry = await fetch(`${base}/api/twilio/whatsapp`, form(VALID));
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200, "retries still get a valid 200");
    await settle();
    assert.equal(sessions.inputs.length, 1, "only one orchestration for the same MessageSid");
    assert.equal(sender.sent.length, 1);
  });
});
