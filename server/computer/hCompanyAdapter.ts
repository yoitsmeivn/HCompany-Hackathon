import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ComputerTaskAdapter, ComputerTaskRequest, ComputerTaskResult } from "./types.js";

// Real H Company Computer Use executor. It drives H Agent (Holo3) on the actual
// desktop through the open-source HoloDesktop CLI (`holo run "<task>"`), which
// H Company documents as the local computer-use harness with model inference via
// the H Models API or a self-hosted server. This is the Computer Use track's
// "real desktop actions": the instruction planned by the brain is executed by
// Holo on-device. steer/pause/stop are not offered by the one-shot CLI surface.
//
// The CLI is invoked with execFile (argv array, no shell) so the model-authored
// instruction is never interpolated into a shell command line.

export interface HoloCliRunner {
  (bin: string, args: string[], options: { timeoutMs: number }): Promise<{ stdout: string; stderr: string }>;
}

export interface HCompanyAdapterOptions {
  bin: string;
  timeoutMs: number;
  /** argv prefix before the instruction. Defaults to ["run"] → `holo run "<task>"`. */
  runArgs?: string[];
}

const SUMMARY_MAX = 600;

const defaultRunner: HoloCliRunner = (bin, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) { reject(error instanceof Error ? error : new Error(String(error))); return; }
      resolve({ stdout, stderr });
    });
  });

export class HCompanyComputerTaskAdapter implements ComputerTaskAdapter {
  readonly provider = "h-company" as const;

  constructor(
    private readonly options: HCompanyAdapterOptions,
    private readonly runner: HoloCliRunner = defaultRunner,
  ) {}

  async run(request: ComputerTaskRequest): Promise<ComputerTaskResult> {
    const taskId = `holo-${randomUUID()}`;
    const args = [...(this.options.runArgs ?? ["run"]), request.instruction];
    try {
      const { stdout } = await this.runner(this.options.bin, args, { timeoutMs: this.options.timeoutMs });
      const summary = truncate(stdout.trim()) || `HoloDesktop completed the task on ${request.computerId}.`;
      return { taskId, status: "completed", summary };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "HoloDesktop CLI failed";
      return { taskId, status: "failed", summary: `HoloDesktop could not complete the task: ${truncate(detail)}` };
    }
  }

  async steer(_taskId: string, _instruction: string): Promise<void> { throw new Error("HoloDesktop CLI runs one-shot tasks and cannot be steered mid-task"); }
  async pause(_taskId: string): Promise<void> { throw new Error("HoloDesktop CLI runs one-shot tasks and cannot be paused"); }
  async stop(_taskId: string): Promise<void> { throw new Error("HoloDesktop CLI runs one-shot tasks and cannot be stopped"); }
}

function truncate(value: string): string {
  return value.length > SUMMARY_MAX ? `${value.slice(0, SUMMARY_MAX - 1)}…` : value;
}
