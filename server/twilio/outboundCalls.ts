import twilio from "twilio";
import { z } from "zod";
import type { ServerConfig } from "../config.js";

const e164 = /^\+[1-9]\d{7,14}$/;
export const outboundCallRequestSchema = z.object({ to: z.string().min(1).max(64) }).strict().transform(({ to }) => ({ to: normalizeE164(to) })).pipe(z.object({ to: z.string().regex(e164, "Destination must be a valid E.164 phone number") }));

export interface TwilioCallsClient {
  calls: {
    create(input: { to: string; from: string; url: string; method: "POST" }): Promise<{ sid: string; status: string }>;
  };
}

export interface OutboundCallResult { callSid: string; status: string }

export class OutboundCallService {
  constructor(private readonly config: ServerConfig, private readonly clientFactory: (accountSid: string, authToken: string) => TwilioCallsClient = twilio) {}

  async start(raw: unknown): Promise<OutboundCallResult> {
    const { to } = outboundCallRequestSchema.parse(raw);
    const accountSid = required(this.config.twilioAccountSid, "TWILIO_ACCOUNT_SID");
    const authToken = required(this.config.twilioAuthToken, "TWILIO_AUTH_TOKEN");
    const from = normalizeConfiguredPhone(required(this.config.twilioPhoneNumber, "TWILIO_PHONE_NUMBER"));
    if (!this.config.publicBaseUrl || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/.test(this.config.publicBaseUrl)) {
      throw new OutboundCallConfigurationError("KYLIAN_PUBLIC_BASE_URL must be configured with the public HTTPS tunnel URL");
    }
    const call = await this.clientFactory(accountSid, authToken).calls.create({
      to,
      from,
      url: new URL("/api/twilio/voice", this.config.publicBaseUrl).toString(),
      method: "POST",
    });
    return { callSid: call.sid, status: call.status };
  }
}

export class OutboundCallConfigurationError extends Error {}

export function normalizeE164(value: string): string {
  return value.trim().replace(/[\s().-]/g, "");
}

function normalizeConfiguredPhone(value: string): string {
  const normalized = normalizeE164(value);
  if (!e164.test(normalized)) throw new OutboundCallConfigurationError("TWILIO_PHONE_NUMBER must be a valid E.164 phone number");
  return normalized;
}
function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new OutboundCallConfigurationError(`${name} is required to start a test call`);
  return value.trim();
}
