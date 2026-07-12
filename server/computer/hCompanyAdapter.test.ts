import assert from "node:assert/strict";
import test from "node:test";
import type { ComputerTaskRequest } from "./types.js";
import { HCompanyComputerTaskAdapter, type HoloCliRunner } from "./hCompanyAdapter.js";

function request(instruction: string): ComputerTaskRequest {
  return { sessionId: "s1", computerId: "demo-computer", instruction, allowedFolders: [], allowedApplications: [] };
}

test("invokes the HoloDesktop CLI with `run` and the instruction as a single argv element", async () => {
  const seen: Array<{ bin: string; args: string[] }> = [];
  const runner: HoloCliRunner = async (bin, args) => { seen.push({ bin, args }); return { stdout: "Opened Calculator; result 4", stderr: "" }; };
  const adapter = new HCompanyComputerTaskAdapter({ bin: "holo", timeoutMs: 1000 }, runner);

  const result = await adapter.run(request("Open Calculator and compute 2+2"));

  assert.deepEqual(seen, [{ bin: "holo", args: ["run", "Open Calculator and compute 2+2"] }]);
  assert.equal(result.status, "completed");
  assert.equal(result.summary, "Opened Calculator; result 4");
  assert.match(result.taskId, /^holo-/);
  assert.equal(adapter.provider, "h-company");
});

test("a CLI failure becomes a failed task result rather than throwing", async () => {
  const runner: HoloCliRunner = async () => { throw new Error("holo: not logged in"); };
  const adapter = new HCompanyComputerTaskAdapter({ bin: "holo", timeoutMs: 1000 }, runner);

  const result = await adapter.run(request("Do something"));

  assert.equal(result.status, "failed");
  assert.match(result.summary, /HoloDesktop could not complete the task/);
  assert.match(result.summary, /not logged in/);
});

test("empty stdout falls back to a generic completion summary", async () => {
  const runner: HoloCliRunner = async () => ({ stdout: "  \n", stderr: "" });
  const adapter = new HCompanyComputerTaskAdapter({ bin: "holo", timeoutMs: 1000 }, runner);
  const result = await adapter.run(request("Take a screenshot"));
  assert.equal(result.status, "completed");
  assert.equal(result.summary, "HoloDesktop completed the task on demo-computer.");
});

test("long CLI output is truncated for the summary", async () => {
  const runner: HoloCliRunner = async () => ({ stdout: "x".repeat(5000), stderr: "" });
  const adapter = new HCompanyComputerTaskAdapter({ bin: "holo", timeoutMs: 1000 }, runner);
  const result = await adapter.run(request("Verbose task"));
  assert.ok(result.summary.length <= 600);
  assert.ok(result.summary.endsWith("…"));
});

test("steer/pause/stop reject: the one-shot CLI has no mid-task control", async () => {
  const adapter = new HCompanyComputerTaskAdapter({ bin: "holo", timeoutMs: 1000 }, async () => ({ stdout: "", stderr: "" }));
  await assert.rejects(() => adapter.steer("t", "x"), /cannot be steered/);
  await assert.rejects(() => adapter.pause("t"), /cannot be paused/);
  await assert.rejects(() => adapter.stop("t"), /cannot be stopped/);
});
