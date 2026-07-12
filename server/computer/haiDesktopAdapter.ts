import { randomUUID } from "node:crypto";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { ComputerTaskAdapter, ComputerTaskRequest, ComputerTaskResult } from "./types.js";

// Real H Company Computer-Use executor. It submits the instruction to the
// local hai-agents[desktop] service (poc/hai-desktop/desktop_service.py) on
// 127.0.0.1 and polls for status + safe lifecycle events until the task
// settles. The service enforces one active desktop task, bearer auth, and
// never returns model reasoning or screenshots — so everything the adapter
// sees is safe to forward into runtime events. The bearer token never appears
// in results, event labels, or errors.

export interface HaiDesktopAdapterOptions {
  baseUrl: string;
  token: string;
  /** Per-task budget forwarded to the service; also bounds local polling. */
  taskTimeoutSeconds: number;
  pollIntervalMs?: number;
  /** Extra local slack past the task budget before the adapter gives up. */
  pollGraceMs?: number;
}

type FetchLike = typeof fetch;

interface ServiceTaskRecord {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "timed_out";
  hSessionId: string | null;
  outcome: string | null;
  answer: string | null;
  error: string | null;
}

const SUMMARY_MAX = 600;
const POLL_INTERVAL_MS = 1_500;
const POLL_GRACE_MS = 30_000;
const MAX_POLL_FAILURES = 4;

export class HaiDesktopComputerTaskAdapter implements ComputerTaskAdapter {
  readonly provider = "hai-desktop" as const;

  constructor(
    private readonly options: HaiDesktopAdapterOptions,
    private readonly events?: RuntimeEventHub,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async run(request: ComputerTaskRequest): Promise<ComputerTaskResult> {
    const taskId = `hai-${randomUUID()}`;
    const submitted = await this.submit(taskId, request);
    if (!submitted.ok) return { taskId, status: "failed", summary: submitted.error };
    this.emit(request.sessionId, "Desktop task queued", "pending");

    const deadline = Date.now() + this.options.taskTimeoutSeconds * 1_000 + (this.options.pollGraceMs ?? POLL_GRACE_MS);
    const pollInterval = this.options.pollIntervalMs ?? POLL_INTERVAL_MS;
    let eventsFrom = 0;
    let steps = 0;
    let started = false;
    let pollFailures = 0;

    while (Date.now() < deadline) {
      await sleep(pollInterval);
      let record: ServiceTaskRecord;
      try {
        record = await this.getJson<ServiceTaskRecord>(`/tasks/${taskId}`);
        const page = await this.getJson<{ events: Array<{ kind: string }>; next: number }>(
          `/tasks/${taskId}/events?from=${eventsFrom}`,
        );
        eventsFrom = page.next;
        if (!started && (record.status === "running" || page.events.some((event) => event.kind === "agent_started"))) {
          started = true;
          this.emit(request.sessionId, "Desktop agent started", "current");
        }
        const newSteps = page.events.filter((event) => event.kind.startsWith("agent:")).length;
        if (newSteps > 0) {
          steps += newSteps;
          this.emit(request.sessionId, `Working on the desktop (step ${steps})`, "current");
        }
        pollFailures = 0;
      } catch {
        pollFailures += 1;
        if (pollFailures >= MAX_POLL_FAILURES) {
          return { taskId, status: "failed", summary: "The desktop service stopped responding while the task was running." };
        }
        continue;
      }
      if (isTerminal(record.status)) return this.toResult(taskId, record);
    }

    // Local deadline breached (service watchdog should have fired first).
    await this.cancelQuietly(taskId);
    return { taskId, status: "failed", summary: "The desktop task timed out before completing." };
  }

  async steer(_taskId: string, _instruction: string): Promise<void> {
    throw new Error("The hai-desktop executor cannot be steered mid-task");
  }

  async pause(_taskId: string): Promise<void> {
    throw new Error("The hai-desktop executor cannot be paused");
  }

  async stop(taskId: string): Promise<void> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Desktop service refused to cancel the task (HTTP ${response.status})`);
  }

  private async submit(
    taskId: string,
    request: ComputerTaskRequest,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}/tasks`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          kylianSessionId: request.sessionId,
          instruction: request.instruction,
          timeoutSeconds: this.options.taskTimeoutSeconds,
        }),
      });
    } catch {
      return { ok: false, error: "The desktop service is not reachable. Is it running on this computer?" };
    }
    if (response.status === 401) return { ok: false, error: "The desktop service rejected Kylian's credentials." };
    if (response.status === 409) return { ok: false, error: "The computer is busy with another desktop task. Try again shortly." };
    if (!response.ok) return { ok: false, error: `The desktop service could not accept the task (HTTP ${response.status}).` };
    return { ok: true };
  }

  private toResult(taskId: string, record: ServiceTaskRecord): ComputerTaskResult {
    if (record.status === "completed") {
      const summary =
        record.answer?.trim() ||
        (record.outcome ? `Desktop task finished (${record.outcome}).` : "Desktop task completed.");
      return { taskId, status: "completed", summary: truncate(summary) };
    }
    const detail = record.error?.trim();
    const summary =
      record.status === "cancelled"
        ? "The desktop task was cancelled."
        : record.status === "timed_out"
          ? "The desktop task timed out before completing."
          : `The desktop task failed${detail ? `: ${detail}` : "."}`;
    return { taskId, status: "failed", summary: truncate(summary) };
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, { headers: this.headers() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  private async cancelQuietly(taskId: string): Promise<void> {
    try {
      await this.stop(taskId);
    } catch {
      // Best effort — the service watchdog cancels the H session regardless.
    }
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.options.token}` };
  }

  private emit(sessionId: string, label: string, state: "done" | "current" | "pending"): void {
    this.events?.emit({ kind: "computer-action", sessionId, label, state });
  }
}

function isTerminal(status: ServiceTaskRecord["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "timed_out";
}

function truncate(value: string): string {
  return value.length > SUMMARY_MAX ? `${value.slice(0, SUMMARY_MAX - 1)}…` : value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
