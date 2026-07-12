import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { MockComputerTaskAdapter } from "./computer/mockComputerTaskAdapter.js";
import { MockOrchestrator } from "./orchestrator/mockOrchestrator.js";
import { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "./runtime/eventHub.js";
import { PolicyStore } from "./runtime/policyStore.js";

function build() {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer", TWILIO_PHONE_NUMBER: "+16505407272" });
  const events = new RuntimeEventHub();
  const sessions = new SessionOrchestrationService(new MockOrchestrator(new MockComputerTaskAdapter(), events), events);
  const policies = new PolicyStore();
  return { app: createApp(config, events, sessions, policies), events, policies };
}

async function withServer<T>(app: ReturnType<typeof build>["app"], run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function readFirstMonitorEvent(baseUrl: string): Promise<{ event: { kind: string; sessionId?: string } }> {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/monitor/events`, { signal: controller.signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before an event arrived");
      buffer += decoder.decode(value, { stream: true });
      for (const line of buffer.split("\n")) {
        if (line.startsWith("data: ")) return JSON.parse(line.slice(6));
      }
    }
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
}

test("exposes public runtime config for the monitoring UI", async () => {
  const { app } = build();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/config`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { voiceComputerId: "demo-computer", twilioPhoneNumber: "+16505407272", voiceConfigured: false });
  });
});

test("stores an owner policy for a computer", async () => {
  const { app, policies } = build();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/computers/demo-computer/policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerName: "Ada", authorizedPhone: "+16505550000", allowedFolders: ["Documents"], allowedApplications: ["Finder"] }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(policies.get("demo-computer"), { ownerName: "Ada", authorizedPhone: "+16505550000", allowedFolders: ["Documents"], allowedApplications: ["Finder"] });
  });
});

test("simulates an inbound call in mock mode", async () => {
  const { app } = build();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/monitor/simulate-call`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "+16505550000" }),
    });
    assert.equal(response.status, 202);
    const body = (await response.json()) as { sessionId: string };
    assert.match(body.sessionId, /^SIM/);
  });
});

test("refuses to simulate a call outside mock mode", async () => {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer", KYLIAN_EXECUTOR_MODE: "h-company" });
  const events = new RuntimeEventHub();
  const sessions = new SessionOrchestrationService(new MockOrchestrator(new MockComputerTaskAdapter(), events), events);
  const app = createApp(config, events, sessions, new PolicyStore());
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/monitor/simulate-call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 403);
  });
});

test("broadcasts call-started to a monitoring subscriber", async () => {
  const { app, events } = build();
  await withServer(app, async (baseUrl) => {
    events.emitMonitor({ kind: "call-started", sessionId: "CA123", computerId: "demo-computer", from: "+16505550000" });
    const message = await readFirstMonitorEvent(baseUrl);
    assert.equal(message.event.kind, "call-started");
    assert.equal(message.event.sessionId, "CA123");
  });
});
