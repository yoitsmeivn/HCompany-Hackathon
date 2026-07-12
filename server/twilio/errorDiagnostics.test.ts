import assert from "node:assert/strict";
import test from "node:test";
import twilio from "twilio";
import { loadConfig } from "../config.js";
import { buildTwilioCallErrorResponse, getTwilioErrorDiagnostic } from "./errorDiagnostics.js";

test("sanitizes an official Twilio RestException for logs and development responses", () => {
  const config = {
    ...loadConfig({ KYLIAN_VOICE_PROVIDER: "openai" }),
    twilioAccountSid: "AC11111111111111111111111111111111",
    twilioAuthToken: "top-secret-auth-token",
    twilioPhoneNumber: "+14155550100",
  };
  const error = new twilio.RestException({
    statusCode: 400,
    body: {
      code: 21219,
      message: "The number +13105551234 is unverified for AC11111111111111111111111111111111 using top-secret-auth-token",
      more_info: "https://www.twilio.com/docs/errors/21219",
      details: { request_id: "RQ-safe-request" },
    },
  });
  const diagnostic = getTwilioErrorDiagnostic(error, config);
  assert.deepEqual(diagnostic, {
    provider: "twilio",
    providerCode: 21219,
    providerStatus: 400,
    providerMessage: "The number [redacted-phone] is unverified for [redacted] using [redacted]",
    moreInfo: "https://www.twilio.com/docs/errors/21219",
    requestId: "RQ-safe-request",
  });
  assert.deepEqual(buildTwilioCallErrorResponse(diagnostic!, false), {
    error: {
      code: "TWILIO_CALL_FAILED",
      message: "Twilio could not queue the test call",
      provider: "twilio",
      providerCode: 21219,
      providerStatus: 400,
      providerMessage: "The number [redacted-phone] is unverified for [redacted] using [redacted]",
    },
  });
});

test("production response remains generic", () => {
  const response = buildTwilioCallErrorResponse({ provider: "twilio", providerCode: 21219, providerStatus: 400, providerMessage: "safe" }, true);
  assert.deepEqual(response, { error: { code: "TWILIO_CALL_FAILED", message: "Twilio could not queue the test call" } });
});
