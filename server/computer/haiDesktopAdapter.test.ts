import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeEvent } from "../../shared/runtimeEvents.js";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { HaiDesktopComputerTaskAdapter, HoloDesktopServiceAdapter, NemoclawDesktopServiceAdapter } from "./haiDesktopAdapter.js";

const TOKEN = "test-desktop-token";

const REQUEST = {
  sessionId: "session-1",
  computerId: "demo-computer",
  instruction: "Open Calculator and compute 150 * 8.",
  allowedFolders: [],
  allowedApplications: [],
};

interface RecordedCall {
  path: string;
  method: string;
  auth?: string;
  body?: Record<string, unknown>;
}

/** In-memory stand-in for poc/hai-desktop/desktop_service.py. */
class FakeDesktopService {
  calls: RecordedCall[] = [];
  /** Statuses returned by successive GET /tasks/{id} polls (last one repeats). */
  statuses: string[] = ["running", "completed"];
  record: Record<string, unknown> = { hSessionId: "h-1", outcome: "success", answer: "The result is 1200.", error: null };
  events: Array<{ kind: string }> = [{ kind: "agent_started" }, { kind: "agent:flow_event" }];
  postStatus = 202;
  failGets = false;
  private polls = 0;
  private eventsServed = false;

  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: RecordedCall = { path, method, auth: headers.Authorization };
    if (typeof init?.body === "string") call.body = JSON.parse(init.body);
    this.calls.push(call);

    if (method === "POST" && path === "/tasks") {
      return json(this.postStatus, { taskId: call.body?.taskId, status: "queued", ...this.record });
    }
    if (method === "POST" && path.endsWith("/cancel")) {
      return json(200, { taskId: "x", status: "cancelled", ...this.record });
    }
    if (this.failGets) return json(500, { detail: "boom" });
    if (path.includes("/events")) {
      const events = this.eventsServed ? [] : this.events;
      this.eventsServed = true;
      return json(200, { events, next: this.events.length });
    }
    const status = this.statuses[Math.min(this.polls, this.statuses.length - 1)];
    this.polls += 1;
    return json(200, { taskId: "x", status, ...this.record });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function makeAdapter(service: FakeDesktopService, events?: RuntimeEventHub, timeoutSeconds = 30) {
  return new HaiDesktopComputerTaskAdapter(
    { baseUrl: "http://127.0.0.1:8790", token: TOKEN, taskTimeoutSeconds: timeoutSeconds, pollIntervalMs: 1, pollGraceMs: 200 },
    events,
    service.fetch as typeof fetch,
  );
}

function captureActions(events: RuntimeEventHub): RuntimeEvent[] {
  const seen: RuntimeEvent[] = [];
  events.subscribe("session-1", ({ event }) => { if (event.kind === "computer-action") seen.push(event); });
  return seen;
}

test("a completed service task maps to a completed result carrying the answer", async () => {
  const service = new FakeDesktopService();
  const events = new RuntimeEventHub();
  const actions = captureActions(events);
  const result = await makeAdapter(service, events).run(REQUEST);

  assert.equal(result.status, "completed");
  assert.match(result.summary, /1200/);
  assert.match(result.taskId, /^hai-/);

  const post = service.calls.find((call) => call.method === "POST" && call.path === "/tasks");
  assert.ok(post, "the task is submitted to the service");
  assert.equal(post.auth, `Bearer ${TOKEN}`);
  assert.equal(post.body?.taskId, result.taskId, "the submitted taskId is stable across the run");
  assert.equal(post.body?.kylianSessionId, "session-1");
  assert.equal(post.body?.instruction, REQUEST.instruction);
  assert.equal(post.body?.timeoutSeconds, 30);

  const labels = actions.map((event) => (event.kind === "computer-action" ? event.label : ""));
  assert.ok(labels.includes("Desktop task queued"), "queued progress is emitted");
  assert.ok(labels.includes("Desktop agent started"), "agent-started progress is emitted");
  assert.ok(labels.some((label) => label.startsWith("Working on the desktop")), "step progress is emitted");
});

test("an unreachable service produces a safe failed result", async () => {
  const service = new FakeDesktopService();
  service.fetch = async () => { throw new Error("ECONNREFUSED"); };
  const result = await makeAdapter(service).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /not reachable/);
  assert.ok(!result.summary.includes(TOKEN));
});

test("invalid authentication produces a safe failed result without the token", async () => {
  const service = new FakeDesktopService();
  service.postStatus = 401;
  const result = await makeAdapter(service).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /credentials/);
  assert.ok(!result.summary.includes(TOKEN));
});

test("a busy service (409) is reported as the computer being busy", async () => {
  const service = new FakeDesktopService();
  service.postStatus = 409;
  const result = await makeAdapter(service).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /busy with another desktop task/);
});

test("a failed H session surfaces the stable error text", async () => {
  const service = new FakeDesktopService();
  service.statuses = ["failed"];
  service.record = { hSessionId: "h-1", outcome: null, answer: null, error: "no_answer template (code=no_answer)" };
  const result = await makeAdapter(service).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /no_answer/);
});

test("timed_out and cancelled service statuses map to failed results with clear summaries", async () => {
  for (const [status, expected] of [["timed_out", /timed out/], ["cancelled", /cancelled/]] as const) {
    const service = new FakeDesktopService();
    service.statuses = [status];
    service.record = { hSessionId: "h-1", outcome: null, answer: null, error: null };
    const result = await makeAdapter(service).run(REQUEST);
    assert.equal(result.status, "failed");
    assert.match(result.summary, expected);
  }
});

test("a task that never settles hits the local deadline, cancels, and fails safely", async () => {
  const service = new FakeDesktopService();
  service.statuses = ["running"];
  const result = await makeAdapter(service, undefined, 0).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /timed out/);
  assert.ok(service.calls.some((call) => call.path.endsWith("/cancel")), "the adapter cancels on local timeout");
});

test("repeated polling failures give up with a safe error", async () => {
  const service = new FakeDesktopService();
  service.failGets = true;
  const result = await makeAdapter(service).run(REQUEST);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /stopped responding/);
});

test("stop() cancels the task on the service", async () => {
  const service = new FakeDesktopService();
  await makeAdapter(service).stop("hai-abc");
  const cancel = service.calls.find((call) => call.path === "/tasks/hai-abc/cancel");
  assert.ok(cancel);
  assert.equal(cancel.method, "POST");
  assert.equal(cancel.auth, `Bearer ${TOKEN}`);
});

test("the holo-desktop adapter shares the service contract with its own provider and task prefix", async () => {
  const service = new FakeDesktopService();
  const adapter = new HoloDesktopServiceAdapter(
    { baseUrl: "http://127.0.0.1:8792", token: TOKEN, taskTimeoutSeconds: 30, pollIntervalMs: 1, pollGraceMs: 200 },
    undefined,
    service.fetch as typeof fetch,
  );
  assert.equal(adapter.provider, "holo-desktop");
  const result = await adapter.run(REQUEST);
  assert.equal(result.status, "completed");
  assert.match(result.taskId, /^holo-/);
  const post = service.calls.find((call) => call.method === "POST" && call.path === "/tasks");
  assert.equal(post?.auth, `Bearer ${TOKEN}`);
});

test("the nemoclaw-desktop adapter reuses the contract over a remote HTTPS sandbox URL", async () => {
  const service = new FakeDesktopService();
  const adapter = new NemoclawDesktopServiceAdapter(
    { baseUrl: "https://sandbox.nemoclaw.example:8792", token: TOKEN, taskTimeoutSeconds: 30, pollIntervalMs: 1, pollGraceMs: 200 },
    undefined,
    service.fetch as typeof fetch,
  );
  assert.equal(adapter.provider, "nemoclaw-desktop");
  const result = await adapter.run(REQUEST);
  assert.equal(result.status, "completed");
  assert.match(result.taskId, /^nemo-/);
  const post = service.calls.find((call) => call.method === "POST" && call.path === "/tasks");
  assert.ok(post, "the task is submitted to the sandbox service");
  assert.equal(post.auth, `Bearer ${TOKEN}`);
  assert.ok(!JSON.stringify(post.body).includes(TOKEN), "the token never appears in the task body");
});

test("steer and pause are rejected loudly", async () => {
  const adapter = makeAdapter(new FakeDesktopService());
  await assert.rejects(() => adapter.steer("t", "x"), /cannot be steered/);
  await assert.rejects(() => adapter.pause("t"), /cannot be paused/);
});
