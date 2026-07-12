import type { ServerConfig } from "../config.js";
import type { ComputerTaskAdapter } from "./types.js";
import { MockComputerTaskAdapter } from "./mockComputerTaskAdapter.js";
import { HCompanyComputerTaskAdapter } from "./hCompanyAdapter.js";

/**
 * Selects the computer-use executor from `KYLIAN_EXECUTOR_MODE`. This is the
 * seam that used to be hardcoded to the mock in `index.ts`:
 *
 * - `mock`            → local deterministic adapter (dev/demo fallback).
 * - `h-company`       → real desktop actions via the HoloDesktop CLI.
 * - `local-companion` → future authenticated local companion (contract only).
 */
export function createComputerAdapter(config: ServerConfig): ComputerTaskAdapter {
  switch (config.executorMode) {
    case "h-company":
      return new HCompanyComputerTaskAdapter({ bin: config.holoCliBin, timeoutMs: config.holoTaskTimeoutMs });
    case "local-companion":
      throw new Error("KYLIAN_EXECUTOR_MODE=local-companion is not implemented yet; use mock or h-company");
    case "mock":
    default:
      return new MockComputerTaskAdapter();
  }
}
