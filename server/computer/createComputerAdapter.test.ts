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

test("local-companion is not yet implemented and fails loudly", () => {
  assert.throws(
    () => createComputerAdapter(loadConfig({ ...base, KYLIAN_EXECUTOR_MODE: "local-companion" })),
    /local-companion is not implemented/,
  );
});
