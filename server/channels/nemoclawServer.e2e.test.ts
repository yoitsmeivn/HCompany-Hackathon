import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

// End-to-end test for the NemoClaw / WhatsApp ingress.
//
// Unlike nemoclawChannel.test.ts (which mounts the handler in-process), this
// boots the real server binary (server/index.ts) on a free port and calls it
// over localhost HTTP — the same request the OpenClaw `kylian_handle_message`
// tool makes from the NemoClaw sandbox. The server runs in mock mode (no
// OpenAI/Twilio/Gradium credentials) so the round-trip is deterministic and
// makes no external network calls.

const TOKEN = "local-e2e-secret";
const NEMOCLAW_URL = "/api/channels/nemoclaw/messages";

let child: ChildProcess;
let baseUrl: string;
let serverLog = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early (code ${child.exitCode}):\n${serverLog}`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server never became healthy:\n${serverLog}`);
}

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${baseUrl}${NEMOCLAW_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const message = (overrides: Record<string, unknown> = {}) => ({
  whatsappUserId: "15551230000",
  messageId: "wamid.e2e.1",
  text: "Find the latest quarterly report",
  ...overrides,
});

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const entry = fileURLToPath(new URL("../index.ts", import.meta.url));
  child = spawn(process.execPath, ["--import", "tsx", entry], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      KYLIAN_API_PORT: String(port),
      KYLIAN_PUBLIC_BASE_URL: baseUrl,
      KYLIAN_EXECUTOR_MODE: "mock",
      KYLIAN_VOICE_PROVIDER: "openai",
      KYLIAN_VOICE_COMPUTER_ID: "demo-computer",
      NEMOCLAW_INGRESS_TOKEN: TOKEN,
      WHATSAPP_ALLOWED_IDS: "15551230000",
      // Force the deterministic mock orchestrator and disable outbound transports.
      OPENAI_API_KEY: "",
      TWILIO_ACCOUNT_SID: "",
      TWILIO_AUTH_TOKEN: "",
      TWILIO_MEDIA_STREAM_URL: "",
      GRADIUM_API_KEY: "",
      GRADIUM_TTS_VOICE: "",
    },
  });
  child.stdout?.on("data", (chunk: Buffer) => { serverLog += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { serverLog += chunk.toString(); });
  await waitForHealth(baseUrl);
});

after(async () => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
});

test("health endpoint reports the mock orchestrator is live", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, orchestrator: "mock" });
});

test("rejects a WhatsApp message with no ingress token", async () => {
  const response = await post(message());
  assert.equal(response.status, 401);
});

test("rejects a WhatsApp message with the wrong ingress token", async () => {
  const response = await post(message(), { Authorization: "Bearer nope" });
  assert.equal(response.status, 401);
});

test("accepts an authenticated WhatsApp message and returns Kylian's reply", async () => {
  const response = await post(message(), { Authorization: `Bearer ${TOKEN}` });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { messageId: string; text: string };
  assert.equal(body.messageId, "wamid.e2e.1");
  assert.equal(typeof body.text, "string");
  assert.ok(body.text.length > 0, "expected a non-empty reply");
});

test("also accepts the token via the x-nemoclaw-token header", async () => {
  const response = await post(message({ messageId: "wamid.e2e.2" }), { "x-nemoclaw-token": TOKEN });
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { messageId: string }).messageId, "wamid.e2e.2");
});

test("rejects an authenticated sender that is not on the allowlist with 403", async () => {
  const response = await post(message({ whatsappUserId: "15559998888", messageId: "wamid.e2e.deny" }), { Authorization: `Bearer ${TOKEN}` });
  assert.equal(response.status, 403);
});

test("rejects a malformed payload with 400", async () => {
  const response = await post({ whatsappUserId: "15551230000", messageId: "wamid.e2e.3" }, { Authorization: `Bearer ${TOKEN}` });
  assert.equal(response.status, 400);
});

test("keeps one session per WhatsApp user across sequential messages", async () => {
  const first = await post(message({ messageId: "wamid.e2e.4", text: "Open the sales deck" }), { Authorization: `Bearer ${TOKEN}` });
  const second = await post(message({ messageId: "wamid.e2e.5", text: "Send me the newest version" }), { Authorization: `Bearer ${TOKEN}` });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(((await second.json()) as { messageId: string }).messageId, "wamid.e2e.5");
});
