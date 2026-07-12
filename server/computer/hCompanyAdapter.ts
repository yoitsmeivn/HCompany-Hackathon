import type { ComputerTaskAdapter, ComputerTaskResult } from "./types.js";

// Boundary for HoloDesktop CLI/MCP/ACP/A2A. H Company currently documents
// those harness interfaces and an OpenAI-compatible model API, not a stable
// hosted task-lifecycle REST contract. Wire a verified transport here later.
export class HCompanyComputerTaskAdapter implements ComputerTaskAdapter {
  readonly provider = "h-company" as const;
  private unavailable(): never { throw new Error("H Company computer execution is not configured"); }
  run(): Promise<ComputerTaskResult> { return this.unavailable(); }
  steer(): Promise<void> { return this.unavailable(); }
  pause(): Promise<void> { return this.unavailable(); }
  stop(): Promise<void> { return this.unavailable(); }
}
