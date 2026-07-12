import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeEventHub } from "../runtime/eventHub.js";
import { SessionOrchestrationService, type Orchestrator } from "./sessionOrchestrationService.js";
import type { OrchestratorInput, OrchestratorResult } from "./types.js";

class SpyOrchestrator implements Orchestrator {
  channels: Array<OrchestratorInput["channel"]> = [];
  constructor(private readonly reply: string) {}
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    this.channels.push(input.channel);
    return { text: this.reply };
  }
}

test("voice input goes to the default (voice) brain even when a text brain exists", async () => {
  const voice = new SpyOrchestrator("voice-reply");
  const text = new SpyOrchestrator("text-reply");
  const service = new SessionOrchestrationService(voice, new RuntimeEventHub(), text);

  const result = await service.handle({ sessionId: "voice-1", computerId: "c", text: "hi", allowedFolders: [], allowedApplications: [], channel: "voice" });

  assert.equal(result.text, "voice-reply");
  assert.deepEqual(voice.channels, ["voice"]);
  assert.deepEqual(text.channels, []);
});

test("text input is routed to the text brain when one is configured", async () => {
  const voice = new SpyOrchestrator("voice-reply");
  const text = new SpyOrchestrator("text-reply");
  const service = new SessionOrchestrationService(voice, new RuntimeEventHub(), text);

  const result = await service.handle({ sessionId: "whatsapp:1", computerId: "c", text: "hi", allowedFolders: [], allowedApplications: [], channel: "text" });

  assert.equal(result.text, "text-reply");
  assert.deepEqual(text.channels, ["text"]);
  assert.deepEqual(voice.channels, []);
});

test("without a text brain, every channel falls back to the single orchestrator", async () => {
  const only = new SpyOrchestrator("only-reply");
  const service = new SessionOrchestrationService(only, new RuntimeEventHub());

  await service.handle({ sessionId: "whatsapp:1", computerId: "c", text: "hi", allowedFolders: [], allowedApplications: [], channel: "text" });
  await service.handle({ sessionId: "voice-1", computerId: "c", text: "hi", allowedFolders: [], allowedApplications: [], channel: "voice" });

  assert.deepEqual(only.channels, ["text", "voice"]);
});
