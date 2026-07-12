import express from "express";
import path from "node:path";
import { z, ZodError } from "zod";
import type { ServerConfig } from "./config.js";
import type { RuntimeEventHub } from "./runtime/eventHub.js";
import type { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { PolicyStore } from "./runtime/policyStore.js";
import { incomingVoice, validateTwilio } from "./twilio/routes.js";
import { nemoclawIngress, validateNemoclaw } from "./channels/nemoclawChannel.js";
import { twilioWhatsappInbound, type OutboundWhatsApp } from "./channels/twilioWhatsappChannel.js";
import { createReadStream } from "node:fs";
import type { ArtifactPublisher } from "./artifacts/artifactPublisher.js";
import { OutboundCallConfigurationError, OutboundCallService } from "./twilio/outboundCalls.js";
import { buildTwilioCallErrorResponse, getTwilioErrorDiagnostic } from "./twilio/errorDiagnostics.js";

const policySchema = z.object({
  ownerName: z.string().max(200).default(""),
  authorizedPhone: z.string().max(40).default(""),
  allowedFolders: z.array(z.string().max(200)).max(100).default([]),
  allowedApplications: z.array(z.string().max(200)).max(100).default([]),
});

export function createApp(config: ServerConfig, events: RuntimeEventHub, sessions: SessionOrchestrationService, policies = new PolicyStore(), outboundCalls = new OutboundCallService(config), whatsapp?: OutboundWhatsApp, artifactPublisher?: ArtifactPublisher) {
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Max-Age", "86400");
      response.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/api/health", (_request, response) => response.json({ ok: true, orchestrator: config.openaiApiKey ? "openai" : "mock" }));

  // Public, non-secret runtime facts the monitoring UI needs to render.
  app.get("/api/config", (_request, response) => response.json({
    voiceComputerId: config.voiceComputerId ?? null,
    twilioPhoneNumber: config.twilioPhoneNumber ?? null,
    voiceConfigured: Boolean(config.twilioMediaStreamUrl && config.twilioPhoneNumber),
  }));

  // Owner policy for a computer (identity, authorized caller, access).
  app.put("/api/computers/:computerId/policy", (request, response) => {
    const parsed = policySchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid policy" }); return; }
    policies.set(request.params.computerId, parsed.data);
    response.status(200).json({ accepted: true, computerId: request.params.computerId });
  });

  // Global stream of call lifecycle events for an idle monitoring client.
  app.get("/api/monitor/events", (_request, response) => {
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    response.flushHeaders();
    response.write(": connected\n\n");
    const unsubscribe = events.subscribeMonitor((envelope) => {
      response.write(`id: ${envelope.id}\ndata: ${JSON.stringify(envelope)}\n\n`);
    });
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 20_000);
    _request.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });

  // Dev-only: fake an inbound call so the monitoring flow can be exercised
  // without real telephony. Gated to mock mode so it is inert in production.
  app.post("/api/monitor/simulate-call", (request, response) => {
    if (config.executorMode !== "mock") { response.status(403).json({ error: "Simulated calls are only available in mock mode" }); return; }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const computerId = config.voiceComputerId ?? "demo-computer";
    const from = typeof body.from === "string" && body.from.trim() ? body.from.trim() : "+15555550123";
    const text = typeof body.text === "string" && body.text.trim() ? body.text.trim() : "Find my latest report and send it to me";
    const sessionId = `SIM${Date.now()}`;
    const policy = policies.get(computerId);
    events.emitMonitor({ kind: "call-started", sessionId, computerId, from });
    sessions.enqueue({ sessionId, computerId, text, allowedFolders: policy?.allowedFolders ?? [], allowedApplications: policy?.allowedApplications ?? [] });
    response.status(202).json({ sessionId, from });
  });

  app.get("/api/sessions/:sessionId/events", (request, response) => {
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    response.flushHeaders();
    response.write(": connected\n\n");
    // Browsers resend the last delivered `id:` on EventSource auto-reconnect,
    // so replay resumes where the client left off instead of from the start.
    const lastEventId = request.headers["last-event-id"];
    const unsubscribe = events.subscribe(
      request.params.sessionId,
      (envelope) => {
        response.write(`id: ${envelope.id}\ndata: ${JSON.stringify(envelope)}\n\n`);
      },
      true,
      typeof lastEventId === "string" && lastEventId ? lastEventId : undefined,
    );
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 20_000);
    request.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });

  app.post("/api/sessions/:sessionId/messages", (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.text !== "string" || !body.text.trim() || typeof body.computerId !== "string") {
      response.status(400).json({ error: "text and computerId are required" }); return;
    }
    const sessionId = request.params.sessionId;
    sessions.enqueue({
      sessionId,
      computerId: body.computerId,
      text: body.text.trim(),
      allowedFolders: stringArray(body.allowedFolders),
      allowedApplications: stringArray(body.allowedApplications),
    });
    response.status(202).json({ accepted: true, sessionId });
  });

  app.post("/api/channels/nemoclaw/messages", validateNemoclaw(config), nemoclawIngress(config, sessions, policies));

  // Single-use signed artifact delivery for Twilio WhatsApp media. The token
  // IS the signature: 256-bit random, expiring, consumed on first stream, and
  // re-validated against the artifact before any bytes leave the machine.
  // Tokens are never logged. This is not a static file route.
  if (artifactPublisher) {
    app.get("/api/artifacts/:token", async (request, response) => {
      const record = await artifactPublisher.redeem(request.params.token);
      if (!record) { response.status(404).end(); return; }
      response.status(200).set({ "Content-Type": record.mimeType, "Content-Length": String(record.sizeBytes), "Cache-Control": "no-store" });
      createReadStream(record.localPath).pipe(response);
      console.log(`[artifacts] delivered ${record.artifactId} (${record.displayName})`);
    });
  }

  app.post("/api/twilio/voice", validateTwilio(config), incomingVoice(config));
  // WhatsApp Sandbox ingress — dedicated route, never shared with voice.
  if (config.kylianWhatsappEnabled && whatsapp) {
    app.post("/api/twilio/whatsapp", validateTwilio(config), twilioWhatsappInbound(config, sessions, policies, whatsapp));
  }
  app.post("/api/twilio/calls", async (request, response) => {
    try {
      response.status(202).json(await outboundCalls.start(request.body));
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        response.status(400).json({ error: { code: "INVALID_PHONE_NUMBER", message: error.issues[0]?.message ?? "Invalid destination" } });
        return;
      }
      if (error instanceof OutboundCallConfigurationError) {
        response.status(503).json({ error: { code: "TWILIO_NOT_CONFIGURED", message: error.message } });
        return;
      }
      const diagnostic = getTwilioErrorDiagnostic(error, config);
      if (diagnostic) {
        console.error("Twilio outbound call failed", diagnostic);
        response.status(502).json(buildTwilioCallErrorResponse(diagnostic, process.env.NODE_ENV === "production"));
        return;
      }
      console.error("Twilio outbound call failed", { provider: "twilio", providerMessage: "Unexpected outbound-call error" });
      response.status(502).json({ error: { code: "TWILIO_CALL_FAILED", message: "Twilio could not queue the test call" } });
    }
  });
  if (config.staticDir) {
    // Resolve to an absolute path: res.sendFile throws on relative paths, which
    // would 500 every deep-linked SPA route (e.g. /monitor) when KYLIAN_STATIC_DIR
    // is relative.
    const staticDir = path.resolve(config.staticDir);
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_request: express.Request, response: express.Response) =>
      response.sendFile(path.join(staticDir, "index.html")),
    );
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const message = error instanceof Error ? error.message : "Internal server error";
    response.status(500).json({ error: message });
  });
  return app;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
