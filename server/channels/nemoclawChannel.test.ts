import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { loadConfig } from "../config.js";
import { MockComputerTaskAdapter } from "../computer/mockComputerTaskAdapter.js";
import { MockOrchestrator } from "../orchestrator/mockOrchestrator.js";
import { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { PolicyStore } from "../runtime/policyStore.js";
import type { OrchestratorInput, OrchestratorResult } from "../orchestrator/types.js";
import { nemoclawIngress, summarizeAttachments, validateNemoclaw, whatsappSessionId } from "./nemoclawChannel.js";

function buildApp(env: NodeJS.ProcessEnv, policies = new PolicyStore()) {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer", ...env });
  const events = new RuntimeEventHub();
  const sessions = new SessionOrchestrationService(new MockOrchestrator(new MockComputerTaskAdapter(), events), events);
  const app = express();
  app.use(express.json());
  app.post("/ingress", validateNemoclaw(config), nemoclawIngress(config, sessions, policies));
  return { app, events };
}

// A recording orchestrator that captures the exact OrchestratorInput so tests
// can assert access policy and attachment summaries reach the orchestrator.
function buildRecordingApp(env: NodeJS.ProcessEnv, policies = new PolicyStore()) {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer", ...env });
  const events = new RuntimeEventHub();
  const seen: OrchestratorInput[] = [];
  const orchestrator = {
    async run(input: OrchestratorInput): Promise<OrchestratorResult> {
      seen.push(input);
      return { text: "ok" };
    },
  };
  const sessions = new SessionOrchestrationService(orchestrator, events);
  const app = express();
  app.use(express.json());
  app.post("/ingress", validateNemoclaw(config), nemoclawIngress(config, sessions, policies));
  return { app, seen };
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

test("summarizeAttachments renders a concise metadata note", () => {
  assert.equal(summarizeAttachments(undefined), "");
  assert.equal(summarizeAttachments([]), "");
  assert.equal(
    summarizeAttachments([{ filename: "report.pdf", contentType: "application/pdf" }, { id: "att-2" }]),
    "\n\n[User attached: report.pdf (application/pdf), att-2]",
  );
});

test("rejects a sender that is not on the WhatsApp allowlist", async () => {
  const { app } = buildApp({ WHATSAPP_ALLOWED_IDS: "15550009999" });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappUserId: "15551230000", messageId: "wamid.deny", text: "hi" }),
    });
    assert.equal(response.status, 403);
  });
});

test("accepts a sender that is on the WhatsApp allowlist", async () => {
  const { app } = buildApp({ WHATSAPP_ALLOWED_IDS: "15551230000,15550009999" });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappUserId: "15551230000", messageId: "wamid.allow", text: "hi" }),
    });
    assert.equal(response.status, 200);
  });
});

test("forwards the computer's access policy and attachment summary to the orchestrator", async () => {
  const policies = new PolicyStore();
  policies.set("demo-computer", {
    ownerName: "Owner",
    authorizedPhone: "",
    allowedFolders: ["Documents", "Downloads"],
    allowedApplications: ["Preview"],
  });
  const { app, seen } = buildRecordingApp({}, policies);
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappUserId: "15551230000",
        messageId: "wamid.policy",
        text: "Find the pricing deck",
        attachments: [{ filename: "brief.pdf", contentType: "application/pdf" }],
      }),
    });
    assert.equal(response.status, 200);
  });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].allowedFolders, ["Documents", "Downloads"]);
  assert.deepEqual(seen[0].allowedApplications, ["Preview"]);
  assert.equal(seen[0].text, "Find the pricing deck\n\n[User attached: brief.pdf (application/pdf)]");
});
