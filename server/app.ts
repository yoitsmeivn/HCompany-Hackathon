import express from "express";
import type { ServerConfig } from "./config.js";
import type { RuntimeEventHub } from "./runtime/eventHub.js";
import type { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { incomingVoice, validateTwilio } from "./twilio/routes.js";
import { OutboundCallConfigurationError, OutboundCallService } from "./twilio/outboundCalls.js";
import { ZodError } from "zod";
import { buildTwilioCallErrorResponse, getTwilioErrorDiagnostic } from "./twilio/errorDiagnostics.js";

export function createApp(config: ServerConfig, events: RuntimeEventHub, sessions: SessionOrchestrationService, outboundCalls = new OutboundCallService(config)) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/api/health", (_request, response) => response.json({ ok: true, orchestrator: config.openaiApiKey ? "openai" : "mock" }));

  app.get("/api/sessions/:sessionId/events", (request, response) => {
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    response.flushHeaders();
    response.write(": connected\n\n");
    const unsubscribe = events.subscribe(request.params.sessionId, (envelope) => {
      response.write(`id: ${envelope.id}\ndata: ${JSON.stringify(envelope)}\n\n`);
    });
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

  app.post("/api/twilio/voice", validateTwilio(config), incomingVoice(config));
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
