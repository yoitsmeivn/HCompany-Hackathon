import type { ServerConfig } from "../config.js";
import type { RuntimeEventHub } from "../runtime/eventHub.js";
import type { ComputerTaskAdapter } from "./types.js";
import { MockComputerTaskAdapter } from "./mockComputerTaskAdapter.js";
import { HCompanyComputerTaskAdapter } from "./hCompanyAdapter.js";
import { HaiDesktopComputerTaskAdapter, HoloDesktopServiceAdapter, NemoclawDesktopServiceAdapter } from "./haiDesktopAdapter.js";

/**
 * Selects the computer-use executor from `KYLIAN_EXECUTOR_MODE`. This is the
 * seam that used to be hardcoded to the mock in `index.ts`:
 *
 * - `mock`            → local deterministic adapter (dev/demo fallback).
 * - `h-company`       → real desktop actions via the HoloDesktop CLI.
 * - `hai-desktop`     → real desktop actions via the local hai-agents[desktop]
 *                       service on 127.0.0.1 (poc/hai-desktop).
 * - `holo-desktop`    → real desktop actions via the local HoloDesktop service
 *                       on 127.0.0.1 (poc/holo-desktop, embedded holo client).
 * - `nemoclaw-desktop`→ the same HoloDesktop service, but running inside a remote
 *                       NVIDIA NemoClaw sandbox (isolated virtual desktop) reached
 *                       over authenticated HTTPS instead of the local machine.
 * - `local-companion` → future authenticated local companion (contract only).
 */
export function createComputerAdapter(config: ServerConfig, events?: RuntimeEventHub): ComputerTaskAdapter {
  switch (config.executorMode) {
    case "h-company":
      return new HCompanyComputerTaskAdapter({ bin: config.holoCliBin, timeoutMs: config.holoTaskTimeoutMs });
    case "hai-desktop":
      // loadConfig guarantees the token exists and the URL is loopback-only.
      return new HaiDesktopComputerTaskAdapter(
        {
          baseUrl: config.desktopServiceUrl.replace(/\/$/, ""),
          token: config.desktopServiceToken ?? "",
          taskTimeoutSeconds: config.desktopTaskTimeoutSeconds,
        },
        events,
      );
    case "holo-desktop":
      return new HoloDesktopServiceAdapter(
        {
          baseUrl: config.holoServiceUrl.replace(/\/$/, ""),
          token: config.desktopServiceToken ?? "",
          taskTimeoutSeconds: config.holoTaskTimeoutSeconds,
        },
        events,
      );
    case "nemoclaw-desktop":
      // loadConfig guarantees the token exists and the URL is https (or loopback).
      return new NemoclawDesktopServiceAdapter(
        {
          baseUrl: config.nemoclawDesktopUrl.replace(/\/$/, ""),
          token: config.desktopServiceToken ?? "",
          taskTimeoutSeconds: config.nemoclawDesktopTaskTimeoutSeconds,
        },
        events,
      );
    case "local-companion":
      throw new Error("KYLIAN_EXECUTOR_MODE=local-companion is not implemented yet; use mock or h-company");
    case "mock":
    default:
      return new MockComputerTaskAdapter();
  }
}
