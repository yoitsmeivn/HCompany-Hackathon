import twilio from "twilio";
import type { ServerConfig } from "../config.js";

export interface TwilioErrorDiagnostic {
  provider: "twilio";
  providerCode?: number;
  providerStatus: number;
  providerMessage: string;
  moreInfo?: string;
  requestId?: string;
}

export interface TwilioCallErrorResponse {
  error: {
    code: "TWILIO_CALL_FAILED";
    message: "Twilio could not queue the test call";
    provider?: "twilio";
    providerCode?: number;
    providerStatus?: number;
    providerMessage?: string;
  };
}

export function getTwilioErrorDiagnostic(error: unknown, config: ServerConfig): TwilioErrorDiagnostic | null {
  if (!(error instanceof twilio.RestException) && !isEquivalentRestException(error)) return null;
  const value = error as { status: number; message: string; code?: number; moreInfo?: string; details?: object; requestId?: unknown; request_id?: unknown };
  const details = isRecord(value.details) ? value.details : {};
  const requestId = firstString(value.requestId, value.request_id, details.requestId, details.request_id);
  const redact = (text: string) => redactSensitive(text, [config.twilioAccountSid, config.twilioAuthToken, config.twilioPhoneNumber]);
  return {
    provider: "twilio",
    ...(typeof value.code === "number" ? { providerCode: value.code } : {}),
    providerStatus: value.status,
    providerMessage: redact(value.message || "Twilio REST request failed"),
    ...(value.moreInfo ? { moreInfo: safeMoreInfo(value.moreInfo) } : {}),
    ...(requestId ? { requestId: redact(requestId) } : {}),
  };
}

export function buildTwilioCallErrorResponse(diagnostic: TwilioErrorDiagnostic, production: boolean): TwilioCallErrorResponse {
  const generic: TwilioCallErrorResponse = {
    error: { code: "TWILIO_CALL_FAILED", message: "Twilio could not queue the test call" },
  };
  if (production) return generic;
  return {
    error: {
      ...generic.error,
      provider: "twilio",
      ...(diagnostic.providerCode !== undefined ? { providerCode: diagnostic.providerCode } : {}),
      providerStatus: diagnostic.providerStatus,
      providerMessage: diagnostic.providerMessage,
    },
  };
}

function isEquivalentRestException(error: unknown): error is { status: number; message: string; code?: number; moreInfo?: string; details?: object } {
  return isRecord(error) && typeof error.status === "number" && typeof error.message === "string" && (error.code === undefined || typeof error.code === "number");
}

function redactSensitive(value: string, configuredSecrets: Array<string | undefined>): string {
  let redacted = value;
  for (const secret of configuredSecrets) {
    if (secret && secret.length >= 4) redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted
    .replace(/\+[1-9]\d{7,14}/g, "[redacted-phone]")
    .replace(/\b(?:AC|CA|PN|AP|SK)[A-Za-z0-9]{20,64}\b/g, "[redacted-id]");
}

function safeMoreInfo(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "twilio.com" || url.hostname.endsWith(".twilio.com")) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
