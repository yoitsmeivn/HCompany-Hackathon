import assert from "node:assert/strict";
import test from "node:test";
import { GradiumTtsSession } from "./gradiumTtsSession.js";
import type { WebSocketFactory, WebSocketLike } from "./types.js";

const CONFIG = { apiKey: "test-key", model: "default", voiceId: "voice-1", speed: -1.0, temperature: 0.5, voiceSimilarity: 2.0 };

test("one TTS socket is reused across sequential utterances with per-request client_req_id", async () => {
  const { factory, sockets } = trackingFactory();
  const session = new GradiumTtsSession(CONFIG, factory);
  session.prewarm("MZ1");
  assert.equal(sockets.length, 1, "prewarm opens the socket during call start");
  const first = session.synthesize({ text: "Hi, this is Kylian.", callSid: "CA1", streamSid: "MZ1" });
  sockets[0].open();
  assert.deepEqual(sockets[0].json[0], {
    type: "setup",
    model_name: "default",
    voice_id: "voice-1",
    output_format: "ulaw_8000",
    close_ws_on_eos: false,
    client_req_id: "req-1",
    json_config: { padding_bonus: -1.0, temp: 0.5, cfg_coef: 2.0 },
  });
  sockets[0].message({ type: "ready", request_id: "r1", client_req_id: "req-1" });
  assert.deepEqual(sockets[0].json.slice(1), [
    { type: "text", text: "Hi, this is Kylian.", client_req_id: "req-1" },
    { type: "end_of_stream", client_req_id: "req-1" },
  ]);
  sockets[0].message({ type: "audio", audio: "qrvM", client_req_id: "req-1" });
  sockets[0].message({ type: "end_of_stream", client_req_id: "req-1" });
  assert.deepEqual(await collect(first), ["qrvM"]);

  const second = session.synthesize({ text: "Found it.", callSid: "CA1", streamSid: "MZ1" });
  assert.equal(sockets.length, 1, "second utterance reuses the same socket");
  const secondSetup = sockets[0].json.at(-1);
  assert.equal(secondSetup?.type, "setup");
  assert.equal(secondSetup?.client_req_id, "req-2");
  sockets[0].message({ type: "ready", request_id: "r2", client_req_id: "req-2" });
  sockets[0].message({ type: "audio", audio: "3q2+", client_req_id: "req-2" });
  sockets[0].message({ type: "end_of_stream", client_req_id: "req-2" });
  assert.deepEqual(await collect(second), ["3q2+"]);
  assert.equal(sockets[0].closeCount, 0, "the socket stays open between utterances");
});

test("barge-in closes the socket and the next utterance reconnects once", async () => {
  const { factory, sockets } = trackingFactory();
  const session = new GradiumTtsSession(CONFIG, factory);
  const controller = new AbortController();
  const first = session.synthesize({ text: "Long response", callSid: "CA1", streamSid: "MZ1", signal: controller.signal });
  sockets[0].open();
  sockets[0].message({ type: "ready", request_id: "r1", client_req_id: "req-1" });
  controller.abort();
  assert.equal(sockets[0].closeCount, 1, "abort closes the shared socket (Gradium has no cancel message)");
  assert.deepEqual(await collect(first), []);

  const second = session.synthesize({ text: "Next reply", callSid: "CA1", streamSid: "MZ1" });
  assert.equal(sockets.length, 2, "next utterance reconnects with a fresh socket");
  sockets[1].open();
  sockets[1].message({ type: "audio", audio: "old", client_req_id: "req-1" });
  sockets[1].message({ type: "ready", request_id: "r2", client_req_id: "req-2" });
  sockets[1].message({ type: "audio", audio: "qrvM", client_req_id: "req-2" });
  sockets[1].message({ type: "end_of_stream", client_req_id: "req-2" });
  assert.deepEqual(await collect(second), ["qrvM"], "stale request audio is ignored");
});

test("release closes the per-call socket and provider errors fail only the active request", async () => {
  const { factory, sockets } = trackingFactory();
  const session = new GradiumTtsSession(CONFIG, factory);
  session.prewarm("MZ1");
  sockets[0].open();
  session.release("MZ1");
  assert.equal(sockets[0].closeCount, 1);

  const chunks = session.synthesize({ text: "Hello", callSid: "CA1", streamSid: "MZ1" });
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].message({ type: "ready", request_id: "r1", client_req_id: "req-1" });
  sockets[1].message({ type: "error", message: "backend busy", code: 429, client_req_id: "req-1" });
  await assert.rejects(collect(chunks), /Gradium TTS error 429/);
});

function trackingFactory(): { factory: WebSocketFactory; sockets: FakeWebSocket[] } {
  const sockets: FakeWebSocket[] = [];
  return { sockets, factory: () => { const socket = new FakeWebSocket(); sockets.push(socket); return socket; } };
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const values: string[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  sent: string[] = [];
  closeCount = 0;
  private listeners = new Map<string, Array<(...args: never[]) => void>>();
  get json(): Array<Record<string, unknown>> { return this.sent.map((value) => JSON.parse(value) as Record<string, unknown>); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.closeCount += 1; this.readyState = 3; this.emit("close"); }
  on(event: string, listener: (...args: never[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  open(): void { this.readyState = 1; this.emit("open"); }
  message(value: object): void { this.emit("message", { toString: () => JSON.stringify(value) }); }
  private emit(event: string, ...args: unknown[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args as never[]); }
}
