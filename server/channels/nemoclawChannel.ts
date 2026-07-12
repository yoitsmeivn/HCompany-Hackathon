import type { RequestHandler } from "express";
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import type { SessionOrchestrationService } from "../orchestrator/sessionOrchestrationService.js";
import type { PolicyStore } from "../runtime/policyStore.js";

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

export type NemoclawAttachment = z.infer<typeof attachmentSchema>;

/** Deterministic Kylian session id for a WhatsApp participant. */
export function whatsappSessionId(whatsappUserId: string): string {
  return `whatsapp:${whatsappUserId}`;
}

/**
 * True when the sender is permitted. An empty allowlist means "no restriction"
 * (dev/mock default); a non-empty allowlist rejects any id not on it. Mirrors
 * NemoClaw's own `WHATSAPP_ALLOWED_IDS` gate so the backend enforces it too.
 */
export function isAllowedWhatsappUser(config: ServerConfig, whatsappUserId: string): boolean {
  return config.whatsappAllowedIds.length === 0 || config.whatsappAllowedIds.includes(whatsappUserId);
}

/**
 * Folds attachment metadata into a short, human-readable note appended to the
 * message text so it reaches the orchestrator (and both orchestrator
 * implementations) without new plumbing. Only metadata is forwarded — the
 * bytes stay in WhatsApp/NemoClaw.
 */
export function summarizeAttachments(attachments: NemoclawAttachment[] | undefined): string {
  if (!attachments || attachments.length === 0) return "";
  const items = attachments.map((a) => {
    const name = a.filename ?? a.id ?? "attachment";
    return a.contentType ? `${name} (${a.contentType})` : name;
  });
  return `\n\n[User attached: ${items.join(", ")}]`;
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

export function nemoclawIngress(
  config: ServerConfig,
  sessions: SessionOrchestrationService,
  policies: PolicyStore,
): RequestHandler {
  return async (request, response) => {
    const parsed = nemoclawMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid WhatsApp message" });
      return;
    }
    const message = parsed.data;
    if (!isAllowedWhatsappUser(config, message.whatsappUserId)) {
      response.status(403).json({ messageId: message.messageId, error: "Sender is not authorized" });
      return;
    }
    // Enforce the owner's access policy for this computer, same as the voice
    // and simulate-call paths — never run a WhatsApp task with empty access
    // when a policy exists.
    const policy = policies.get(config.nemoclawComputerId);
    try {
      const result = await sessions.handle({
        sessionId: whatsappSessionId(message.whatsappUserId),
        computerId: config.nemoclawComputerId,
        text: message.text + summarizeAttachments(message.attachments),
        allowedFolders: policy?.allowedFolders ?? [],
        allowedApplications: policy?.allowedApplications ?? [],
        channel: "text",
      });
      response.status(200).json({ messageId: message.messageId, text: result.text });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "Kylian could not handle the message";
      response.status(502).json({ messageId: message.messageId, error: detail });
    }
  };
}
