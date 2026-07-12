import twilio from "twilio";
import type { ServerConfig } from "../config.js";
import { normalizeE164 } from "./outboundCalls.js";

// Deterministic outbound WhatsApp adapter over the official Twilio SDK.
// Recipient defaults to the owner's configured WhatsApp; addresses are
// normalized to whatsapp:+E164; the auth token never appears in errors or
// logs. The client factory is injectable so tests never touch Twilio.

const E164 = /^\+[1-9]\d{6,14}$/;
const BODY_MAX = 1600; // Twilio's per-message body limit.
const IDEMPOTENCY_CACHE_MAX = 200;

export interface TwilioMessagesClient {
  messages: {
    create(input: { from: string; to: string; body?: string; mediaUrl?: string[] }): Promise<{ sid: string; status: string }>;
  };
}

export interface WhatsAppSendResult { sid: string; status: string }

export class WhatsAppConfigurationError extends Error {}

export class WhatsAppSender {
  private readonly sent = new Map<string, WhatsAppSendResult>();

  constructor(
    private readonly config: ServerConfig,
    private readonly clientFactory: (accountSid: string, authToken: string) => TwilioMessagesClient = twilio,
  ) {}

  async sendWhatsAppText(input: { to?: string; body: string; idempotencyKey?: string }): Promise<WhatsAppSendResult> {
    const accountSid = required(this.config.twilioAccountSid, "TWILIO_ACCOUNT_SID");
    const authToken = required(this.config.twilioAuthToken, "TWILIO_AUTH_TOKEN");
    const from = normalizeWhatsAppAddress(required(this.config.twilioWhatsappFrom, "TWILIO_WHATSAPP_FROM"));
    const to = normalizeWhatsAppAddress(input.to ?? required(this.config.kylianWhatsappDefaultTo, "KYLIAN_WHATSAPP_DEFAULT_TO"));

    const body = input.body?.trim();
    if (!body) throw new WhatsAppConfigurationError("WhatsApp message body must not be empty");
    const bounded = body.length > BODY_MAX ? `${body.slice(0, BODY_MAX - 1)}…` : body;

    if (input.idempotencyKey) {
      const prior = this.sent.get(input.idempotencyKey);
      if (prior) return prior;
    }

    return this.deliver({ from, to, body: bounded }, accountSid, authToken, input.idempotencyKey);
  }

  /** Send a media message (the URL must be a short-lived signed HTTPS URL). */
  async sendWhatsAppMedia(input: { mediaUrl: string; caption?: string; to?: string; idempotencyKey?: string }): Promise<WhatsAppSendResult> {
    const accountSid = required(this.config.twilioAccountSid, "TWILIO_ACCOUNT_SID");
    const authToken = required(this.config.twilioAuthToken, "TWILIO_AUTH_TOKEN");
    const from = normalizeWhatsAppAddress(required(this.config.twilioWhatsappFrom, "TWILIO_WHATSAPP_FROM"));
    const to = normalizeWhatsAppAddress(input.to ?? required(this.config.kylianWhatsappDefaultTo, "KYLIAN_WHATSAPP_DEFAULT_TO"));
    if (!/^https:\/\//.test(input.mediaUrl)) throw new WhatsAppConfigurationError("WhatsApp media requires an https URL");
    if (input.idempotencyKey) {
      const prior = this.sent.get(input.idempotencyKey);
      if (prior) return prior;
    }
    const caption = input.caption?.trim();
    const payload: { from: string; to: string; mediaUrl: string[]; body?: string } = { from, to, mediaUrl: [input.mediaUrl] };
    if (caption) payload.body = caption.length > BODY_MAX ? `${caption.slice(0, BODY_MAX - 1)}…` : caption;
    return this.deliver(payload, accountSid, authToken, input.idempotencyKey);
  }

  private async deliver(
    payload: { from: string; to: string; body?: string; mediaUrl?: string[] },
    accountSid: string,
    authToken: string,
    idempotencyKey?: string,
  ): Promise<WhatsAppSendResult> {
    let message: { sid: string; status: string };
    try {
      message = await this.clientFactory(accountSid, authToken).messages.create(payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Twilio request failed";
      throw new Error(`Twilio WhatsApp send failed: ${detail.split(authToken).join("<redacted>")}`);
    }
    const result = { sid: message.sid, status: message.status };
    if (idempotencyKey) {
      this.sent.set(idempotencyKey, result);
      if (this.sent.size > IDEMPOTENCY_CACHE_MAX) {
        const oldest = this.sent.keys().next().value;
        if (oldest !== undefined) this.sent.delete(oldest);
      }
    }
    return result;
  }
}

export function normalizeWhatsAppAddress(value: string): string {
  const number = normalizeE164(value.replace(/^whatsapp:/i, ""));
  if (!E164.test(number)) throw new WhatsAppConfigurationError("WhatsApp address must normalize to whatsapp:+E164");
  return `whatsapp:${number}`;
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new WhatsAppConfigurationError(`${name} is required for WhatsApp sending`);
  return value.trim();
}
