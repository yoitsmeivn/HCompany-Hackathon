import type { RequestHandler } from "express";
import twilio from "twilio";
import type { ServerConfig } from "../config.js";

export function validateTwilio(config: ServerConfig): RequestHandler {
  return (request, response, next) => {
    if (!config.twilioValidateSignatures) { next(); return; }
    if (!config.twilioAuthToken) { response.status(503).json({ error: "Twilio signature validation is not configured" }); return; }
    const signature = request.header("x-twilio-signature") ?? "";
    const url = new URL(request.originalUrl, config.publicBaseUrl).toString();
    if (!twilio.validateRequest(config.twilioAuthToken, signature, url, request.body as Record<string, string>)) {
      response.status(403).json({ error: "Invalid Twilio signature" }); return;
    }
    next();
  };
}

export function incomingVoice(config: ServerConfig): RequestHandler {
  return (request, response) => {
    if (!config.twilioMediaStreamUrl || !config.openaiApiKey || !config.voiceComputerId) {
      response.status(503).json({ error: "Bidirectional voice is not configured" }); return;
    }
    const voice = new twilio.twiml.VoiceResponse();
    const connect = voice.connect();
    const stream = connect.stream({ url: config.twilioMediaStreamUrl });
    stream.parameter({ name: "source", value: "twilio-voice" });
    stream.parameter({ name: "sessionId", value: String(request.body.CallSid) });
    stream.parameter({ name: "computerId", value: config.voiceComputerId });
    response.type("text/xml").send(voice.toString());
  };
}
