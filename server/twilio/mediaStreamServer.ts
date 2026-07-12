import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import twilio from "twilio";
import { WebSocketServer } from "ws";
import type { ServerConfig } from "../config.js";
import type { VoiceRuntime } from "../voice/voiceRuntime.js";
import { logVoice } from "../voice/voiceLog.js";
import { attachConnection } from "./mediaStreamConnection.js";

export function createTwilioMediaStreamServer(config: ServerConfig, voice?: VoiceRuntime) {
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: 2_100_000 });
  webSockets.on("connection", (socket) => {
    if (!voice || !config.voiceComputerId) {
      logVoice("media-stream socket rejected", { reason: "voice runtime not configured" });
      socket.close(1013, "Voice runtime is not configured");
      return;
    }
    logVoice("media-stream socket connected");
    attachConnection(socket, voice, config.voiceComputerId);
  });

  return {
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
      const pathname = new URL(request.url ?? "/", config.publicBaseUrl).pathname;
      if (pathname !== "/twilio/media-stream") return false;
      logVoice("websocket upgrade received", { pathname });
      if (!config.twilioMediaStreamUrl || !voice) { rejectUpgrade(socket, 503, "Voice transport is not configured"); return true; }
      if (config.twilioValidateSignatures) {
        if (!config.twilioAuthToken) { rejectUpgrade(socket, 503, "Twilio signature validation is not configured"); return true; }
        const signature = header(request.headers["x-twilio-signature"]);
        if (!twilio.validateRequest(config.twilioAuthToken, signature, config.twilioMediaStreamUrl, {})) { rejectUpgrade(socket, 403, "Invalid Twilio signature"); return true; }
      }
      webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit("connection", client, request));
      return true;
    },
    close(): Promise<void> { return new Promise((resolve, rejectClose) => webSockets.close((error) => error ? rejectClose(error) : resolve())); },
  };
}

function header(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  logVoice("websocket upgrade rejected", { status, reason: message });
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
}
