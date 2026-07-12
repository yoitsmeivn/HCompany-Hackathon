import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { loadConfig } from "../config.js";
import { MockComputerTaskAdapter } from "../computer/mockComputerTaskAdapter.js";
import { MockOrchestrator } from "../orchestrator/mockOrchestrator.js";
import { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { nemoclawIngress, validateNemoclaw, whatsappSessionId } from "./nemoclawChannel.js";

function buildApp(env: NodeJS.ProcessEnv) {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer", ...env });
  const events = new RuntimeEventHub();
  const sessions = new SessionOrchestrationService(new MockOrchestrator(new MockComputerTaskAdapter(), events), events);
  const app = express();
  app.use(express.json());
  app.post("/ingress", validateNemoclaw(config), nemoclawIngress(config, sessions));
  return { app, events };
}

async function withServer<T>(app: express.Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("derives a deterministic WhatsApp session id", () => {
  assert.equal(whatsappSessionId("15551230000"), "whatsapp:15551230000");
});

test("forwards a WhatsApp message through the orchestrator and returns the reply", async () => {
  const { app } = buildApp({});
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappUserId: "15551230000", messageId: "wamid.1", text: "Find report.pdf" }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { messageId: string; text: string };
    assert.equal(body.messageId, "wamid.1");
    assert.ok(body.text.length > 0);
  });
});

test("rejects invalid payloads", async () => {
  const { app } = buildApp({});
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappUserId: "15551230000", messageId: "wamid.2" }),
    });
    assert.equal(response.status, 400);
  });
});

test("enforces the ingress token when configured", async () => {
  const { app } = buildApp({ NEMOCLAW_INGRESS_TOKEN: "s3cret" });
  await withServer(app, async (baseUrl) => {
    const payload = JSON.stringify({ whatsappUserId: "15551230000", messageId: "wamid.3", text: "hi" });

    const unauthorized = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer s3cret" },
      body: payload,
    });
    assert.equal(authorized.status, 200);
  });
});
