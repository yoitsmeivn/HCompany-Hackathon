import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, type ServerConfig } from "../config.js";
import { OutboundCallConfigurationError, OutboundCallService, normalizeE164, type TwilioCallsClient } from "./outboundCalls.js";

test("valid E.164 destination queues an outbound call with the existing voice webhook", async () => {
  const calls = new FakeCallsClient();
  const service = new OutboundCallService(config(), (accountSid, authToken) => {
    assert.equal(accountSid, "AC-test");
    assert.equal(authToken, "auth-test");
    return calls;
  });
  const result = await service.start({ to: "+13105551234" });
  assert.deepEqual(result, { callSid: "CA-queued", status: "queued" });
  assert.deepEqual(calls.input, {
    to: "+13105551234",
    from: "+14155550100",
    url: "https://public.example/api/twilio/voice",
    method: "POST",
  });
  assert.equal("authToken" in result, false);
  assert.equal("accountSid" in result, false);
});

test("formatted destination is normalized before Twilio receives it", async () => {
  const calls = new FakeCallsClient();
  const service = new OutboundCallService(config(), () => calls);
  await service.start({ to: "  +1 (310) 555-1234  " });
  assert.equal(calls.input?.to, "+13105551234");
  assert.equal(normalizeE164("+1 310 555 1234"), "+13105551234");
});

test("invalid destinations are rejected before creating a Twilio client", async () => {
  let created = false;
  const service = new OutboundCallService(config(), () => { created = true; return new FakeCallsClient(); });
  await assert.rejects(service.start({ to: "555-1234" }), /E.164/);
  await assert.rejects(service.start({ to: "+0123456789" }), /E.164/);
  await assert.rejects(service.start({ to: "+13105551234", extra: true }), /unrecognized/i);
  assert.equal(created, false);
});

for (const [field, message] of [
  ["twilioAccountSid", "TWILIO_ACCOUNT_SID"],
  ["twilioAuthToken", "TWILIO_AUTH_TOKEN"],
  ["twilioPhoneNumber", "TWILIO_PHONE_NUMBER"],
] as const) {
  test(`missing ${message} returns a clear configuration error`, async () => {
    const value = config();
    value[field] = undefined;
    await assert.rejects(new OutboundCallService(value, () => new FakeCallsClient()).start({ to: "+13105551234" }), (error: unknown) => error instanceof OutboundCallConfigurationError && error.message.includes(message));
  });
}

test("missing public base URL returns a clear configuration error", async () => {
  const value = config();
  value.publicBaseUrl = "http://localhost:8787";
  await assert.rejects(new OutboundCallService(value, () => new FakeCallsClient()).start({ to: "+13105551234" }), /KYLIAN_PUBLIC_BASE_URL/);
});

function config(): ServerConfig {
  return {
    ...loadConfig({ KYLIAN_VOICE_PROVIDER: "openai" }),
    publicBaseUrl: "https://public.example",
    twilioAccountSid: "AC-test",
    twilioAuthToken: "auth-test",
    twilioPhoneNumber: "+14155550100",
  };
}

class FakeCallsClient implements TwilioCallsClient {
  input: { to: string; from: string; url: string; method: "POST" } | null = null;
  calls = {
    create: async (input: { to: string; from: string; url: string; method: "POST" }) => {
      this.input = input;
      return { sid: "CA-queued", status: "queued" };
    },
  };
}
