import type { RequestHandler } from "express";
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";

/**
 * NemoClaw / OpenClaw WhatsApp ingress.
 *
 * The OpenClaw agent running inside the NemoClaw sandbox owns a single tool,
 * `kylian_handle_message`, which forwards each inbound WhatsApp message to this
 * endpoint. The Kylian backend runs it through the same orchestrator used for
 * phone and web sessions and returns the reply text for NemoClaw to relay back
 * to WhatsApp. The agent must not plan tasks or hold its own session state — it
 * is a thin ingress adapter, so this endpoint is the whole channel.
 */

const attachmentSchema = z.object({
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  contentType: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
});

export const nemoclawMessageSchema = z.object({
  whatsappUserId: z.string().min(1),
  messageId: z.string().min(1),
  text: z.string().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

export type NemoclawMessage = z.infer<typeof nemoclawMessageSchema>;

/** Deterministic Kylian session id for a WhatsApp participant. */
export function whatsappSessionId(whatsappUserId: string): string {
  return `whatsapp:${whatsappUserId}`;
}

function extractToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const bearer = /^Bearer\s+(.+)$/i.exec(header);
  return bearer ? bearer[1] : header;
}

/** Guards the ingress with the shared `NEMOCLAW_INGRESS_TOKEN` when configured. */
export function validateNemoclaw(config: ServerConfig): RequestHandler {
  return (request, response, next) => {
    if (!config.nemoclawIngressToken) { next(); return; }
    const presented = extractToken(request.header("authorization")) ?? request.header("x-nemoclaw-token");
    if (presented !== config.nemoclawIngressToken) {
      response.status(401).json({ error: "Invalid NemoClaw ingress token" }); return;
    }
    next();
  };
}

export function nemoclawIngress(config: ServerConfig, sessions: SessionOrchestrationService): RequestHandler {
  return async (request, response) => {
    const parsed = nemoclawMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid WhatsApp message" });
      return;
    }
    const message = parsed.data;
    try {
      const result = await sessions.handle({
        sessionId: whatsappSessionId(message.whatsappUserId),
        computerId: config.nemoclawComputerId,
        text: message.text,
        allowedFolders: [],
        allowedApplications: [],
      });
      response.status(200).json({ messageId: message.messageId, text: result.text });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "Kylian could not handle the message";
      response.status(502).json({ messageId: message.messageId, error: detail });
    }
  };
}
