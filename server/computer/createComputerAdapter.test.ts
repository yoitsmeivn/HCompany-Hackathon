import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config.js";
import { createComputerAdapter } from "./createComputerAdapter.js";

const base = { KYLIAN_VOICE_COMPUTER_ID: "demo-computer" };

test("defaults to the mock executor", () => {
  const adapter = createComputerAdapter(loadConfig({ ...base }));
  assert.equal(adapter.provider, "mock");
});

test("selects the H Company executor when KYLIAN_EXECUTOR_MODE=h-company", () => {
  const adapter = createComputerAdapter(loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "h-company" }));
  assert.equal(adapter.provider, "h-company");
});

test("selects the hai-desktop executor when mode and token are configured", () => {
  const adapter = createComputerAdapter(
    loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "hai-desktop", KYLIAN_DESKTOP_SERVICE_TOKEN: "secret" }),
  );
  assert.equal(adapter.provider, "hai-desktop");
});

test("hai-desktop mode requires the service token", () => {
  assert.throws(
    () => loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "hai-desktop" }),
    /KYLIAN_DESKTOP_SERVICE_TOKEN is required/,
  );
});

test("hai-desktop mode rejects non-loopback service URLs", () => {
  assert.throws(
    () =>
      loadConfig({
        ...base,
        KYLIAN_EXECUTOR_MODE: "hai-desktop",
        KYLIAN_DESKTOP_SERVICE_TOKEN: "secret",
        KYLIAN_DESKTOP_SERVICE_URL: "https://example.com:8790",
      }),
    /must stay on loopback/,
  );
});

test("selects the holo-desktop executor when mode and token are configured", () => {
  const adapter = createComputerAdapter(
    loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "holo-desktop", KYLIAN_DESKTOP_SERVICE_TOKEN: "secret" }),
  );
  assert.equal(adapter.provider, "holo-desktop");
});

test("holo-desktop mode requires the shared service token", () => {
  assert.throws(
    () => loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "holo-desktop" }),
    /KYLIAN_DESKTOP_SERVICE_TOKEN is required/,
  );
});

test("holo-desktop mode rejects non-loopback service URLs", () => {
  assert.throws(
    () =>
      loadConfig({
        ...base,
        KYLIAN_EXECUTOR_MODE: "holo-desktop",
        KYLIAN_DESKTOP_SERVICE_TOKEN: "secret",
        KYLIAN_HOLO_SERVICE_URL: "https://example.com:8792",
      }),
    /KYLIAN_HOLO_SERVICE_URL must stay on loopback/,
  );
});

test("local-companion is not yet implemented and fails loudly", () => {
  assert.throws(
    () => createComputerAdapter(loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "local-companion" })),
    /local-companion is not implemented/,
  );
});
