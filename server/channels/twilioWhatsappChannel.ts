import type { RequestHandler } from "express";
import type { ServerConfig } from "../config.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import type { PolicyStore } from "../runtime/policyStore.js";
import type { WhatsAppSendResult } from "../twilio/whatsappSender.js";

// Twilio WhatsApp Sandbox ingress (POST /api/twilio/whatsapp). Completely
// separate from the voice webhook and the NemoClaw JSON ingress. Twilio gives
// webhooks ~15 seconds, while a Kylian turn may include desktop work — so the
// handler acknowledges immediately with empty TwiML and delivers the reply
// asynchronously through the Twilio REST API.

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
const DEDUP_MAX = 500;

export interface OutboundWhatsApp {
  sendWhatsAppText(input: { to?: string; body: string; idempotencyKey?: string }): Promise<WhatsAppSendResult>;
}

export function twilioWhatsappInbound(
  config: ServerConfig,
  sessions: SessionOrchestrationService,
  policies: PolicyStore,
  sender: OutboundWhatsApp,
): RequestHandler {
  // Twilio retries webhooks on timeouts/5xx; MessageSid dedup keeps retries idempotent.
  const seenMessageSids = new Set<string>();

  return (request, response) => {
    const body = request.body as Record<string, unknown>;
    const messageSid = asString(body.MessageSid);
    const from = asString(body.From);
    const to = asString(body.To);
    const text = asString(body.Body).trim();

    if (!messageSid || !from.startsWith("whatsapp:") || !to.startsWith("whatsapp:")) {
      response.status(400).json({ error: "MessageSid plus whatsapp:-prefixed From and To are required" });
      return;
    }
    // Sandbox scope: only the owner's own WhatsApp may talk to Kylian.
    if (from !== config.kylianWhatsappDefaultTo) {
      response.status(403).json({ error: "Sender is not authorized for this sandbox" });
      return;
    }

    // Acknowledge before orchestrating — Twilio only needs a valid TwiML 200.
    response.status(200).type("text/xml").send(EMPTY_TWIML);

    if (seenMessageSids.has(messageSid) || !text) return;
    seenMessageSids.add(messageSid);
    if (seenMessageSids.size > DEDUP_MAX) {
      const oldest = seenMessageSids.values().next().value;
      if (oldest !== undefined) seenMessageSids.delete(oldest);
    }

    const policy = policies.get(config.nemoclawComputerId);
    void (async () => {
      try {
        const result = await sessions.handle({
          // Distinct prefix so these sessions never collide with the NemoClaw
          // channel's `whatsapp:<userId>` ids.
          sessionId: `twilio-whatsapp:${from}`,
          computerId: config.nemoclawComputerId,
          text,
          allowedFolders: policy?.allowedFolders ?? [],
          allowedApplications: policy?.allowedApplications ?? [],
          // Deliberately the OpenAI Responses brain (not the Holo text brain):
          // the send_whatsapp_message tool and the numeric-confirmation rules
          // live there, per the WhatsApp channel requirements.
          channel: "voice",
        });
        const reply = result.text?.trim();
        if (reply) await sender.sendWhatsAppText({ to: from, body: reply, idempotencyKey: `reply:${messageSid}` });
      } catch (error) {
        // Sanitized: message only, never credentials or payload dumps.
        console.error("[whatsapp] inbound handling failed:", error instanceof Error ? error.message : "unknown error");
      }
    })();
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
