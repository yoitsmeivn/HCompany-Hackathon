import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config.js";
import { WhatsAppConfigurationError, WhatsAppSender, normalizeWhatsAppAddress } from "./whatsappSender.js";

const AUTH_TOKEN = "twilio-secret-auth-token";

const env = {
  KYLIAN_VOICE_COMPUTER_ID: "demo-computer",
  KYLIAN_WHATSAPP_ENABLED: "true",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
  KYLIAN_WHATSAPP_DEFAULT_TO: "whatsapp:+14158252791",
  // Voice validation coupling: an auth token requires a media stream URL etc.
  TWILIO_MEDIA_STREAM_URL: "wss://tunnel.example.com/twilio/media-stream",
  OPENAI_API_KEY: "sk-test",
};

class FakeMessages {
  created: Array<{ from: string; to: string; body: string }> = [];
  failWith?: Error;
  credentials: Array<{ sid: string; token: string }> = [];

  factory = (sid: string, token: string) => {
    this.credentials.push({ sid, token });
    return {
      messages: {
        create: async (input: { from: string; to: string; body: string }) => {
          if (this.failWith) throw this.failWith;
          this.created.push(input);
          return { sid: `SM${this.created.length}`, status: "queued" };
        },
      },
    };
  };
}

function makeSender(fake: FakeMessages) {
  return new WhatsAppSender(loadConfig({ ...env }), fake.factory);
}

test("sends a WhatsApp text and returns sid and status", async () => {
  const fake = new FakeMessages();
  const result = await makeSender(fake).sendWhatsAppText({ body: "hello" });
  assert.deepEqual(result, { sid: "SM1", status: "queued" });
  assert.deepEqual(fake.created[0], { from: "whatsapp:+14155238886", to: "whatsapp:+14158252791", body: "hello" });
  assert.deepEqual(fake.credentials[0], { sid: "AC123", token: AUTH_TOKEN });
});

test("normalizes recipient addresses to whatsapp:+E164", async () => {
  const fake = new FakeMessages();
  await makeSender(fake).sendWhatsAppText({ to: " +1 (415) 825-2791 ", body: "hi" });
  assert.equal(fake.created[0].to, "whatsapp:+14158252791");
  assert.equal(normalizeWhatsAppAddress("whatsapp:+14155238886"), "whatsapp:+14155238886");
  assert.throws(() => normalizeWhatsAppAddress("not-a-number"), WhatsAppConfigurationError);
});

test("rejects an empty body and truncates oversized bodies", async () => {
  const fake = new FakeMessages();
  const sender = makeSender(fake);
  await assert.rejects(() => sender.sendWhatsAppText({ body: "   " }), /body must not be empty/);
  await sender.sendWhatsAppText({ body: "x".repeat(2000) });
  assert.equal(fake.created[0].body.length, 1600);
  assert.ok(fake.created[0].body.endsWith("…"));
});

test("duplicate idempotency keys send only once and return the prior result", async () => {
  const fake = new FakeMessages();
  const sender = makeSender(fake);
  const first = await sender.sendWhatsAppText({ body: "one", idempotencyKey: "k1" });
  const second = await sender.sendWhatsAppText({ body: "one", idempotencyKey: "k1" });
  assert.deepEqual(second, first);
  assert.equal(fake.created.length, 1);
});

test("Twilio failures surface as sanitized errors without the auth token", async () => {
  const fake = new FakeMessages();
  fake.failWith = new Error(`401 unauthorized for token ${AUTH_TOKEN}`);
  await assert.rejects(
    () => makeSender(fake).sendWhatsAppText({ body: "hi" }),
    (error: Error) => {
      assert.match(error.message, /Twilio WhatsApp send failed/);
      assert.ok(!error.message.includes(AUTH_TOKEN), "auth token must never leak");
      assert.match(error.message, /<redacted>/);
      return true;
    },
  );
});

test("sends media with a media URL to the owner and rejects non-https URLs", async () => {
  const fake = new FakeMessages();
  const sender = makeSender(fake);
  const result = await sender.sendWhatsAppMedia({ mediaUrl: "https://tunnel.example.com/api/artifacts/abc", caption: "your file" });
  assert.deepEqual(result, { sid: "SM1", status: "queued" });
  const created = fake.created[0] as unknown as { from: string; to: string; mediaUrl: string[]; body?: string };
  assert.deepEqual(created.mediaUrl, ["https://tunnel.example.com/api/artifacts/abc"]);
  assert.equal(created.to, "whatsapp:+14158252791");
  assert.equal(created.body, "your file");
  await assert.rejects(() => sender.sendWhatsAppMedia({ mediaUrl: "http://insecure/x" }), /requires an https URL/);
});

test("missing configuration fails loudly", async () => {
  const config = loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer" });
  const sender = new WhatsAppSender(config, new FakeMessages().factory);
  await assert.rejects(() => sender.sendWhatsAppText({ body: "hi" }), WhatsAppConfigurationError);
});

test("config validation enforces WhatsApp requirements when enabled", () => {
  assert.throws(() => loadConfig({ ...env, TWILIO_ACCOUNT_SID: undefined }), /TWILIO_ACCOUNT_SID is required/);
  assert.throws(() => loadConfig({ ...env, TWILIO_WHATSAPP_FROM: "+14155238886" }), /TWILIO_WHATSAPP_FROM must be a whatsapp:\+E164/);
  assert.throws(() => loadConfig({ ...env, KYLIAN_WHATSAPP_DEFAULT_TO: "whatsapp:12345" }), /KYLIAN_WHATSAPP_DEFAULT_TO must be a whatsapp:\+E164/);
  assert.throws(
    () => loadConfig({ ...env, TWILIO_WHATSAPP_WEBHOOK_URL: "http://tunnel.example.com/api/twilio/whatsapp" }),
    /TWILIO_WHATSAPP_WEBHOOK_URL must be a public https/,
  );
  // Disabled channel requires nothing extra.
  loadConfig({ KYLIAN_VOICE_COMPUTER_ID: "demo-computer" });
});
