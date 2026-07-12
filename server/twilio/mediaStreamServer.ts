import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import twilio from "twilio";
import { WebSocketServer } from "ws";
import type { ServerConfig } from "../config.js";
import type { VoiceRuntime } from "../voice/voiceRuntime.js";
import { attachConnection } from "./mediaStreamConnection.js";

export function createTwilioMediaStreamServer(config: ServerConfig, voice?: VoiceRuntime) {
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: 2_100_000 });
  webSockets.on("connection", (socket) => {
    if (!voice || !config.voiceComputerId) { socket.close(1013, "Voice runtime is not configured"); return; }
    attachConnection(socket, voice, config.voiceComputerId);
  });

  return {
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
      if (new URL(request.url ?? "/", config.publicBaseUrl).pathname !== "/twilio/media-stream") return false;
      if (!config.twilioMediaStreamUrl || !voice) { reject(socket, 503, "Voice transport is not configured"); return true; }
      if (config.twilioValidateSignatures) {
        if (!config.twilioAuthToken) { reject(socket, 503, "Twilio signature validation is not configured"); return true; }
        const signature = header(request.headers["x-twilio-signature"]);
        if (!twilio.validateRequest(config.twilioAuthToken, signature, config.twilioMediaStreamUrl, {})) { reject(socket, 403, "Invalid Twilio signature"); return true; }
      }
      webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit("connection", client, request));
      return true;
    },
    close(): Promise<void> { return new Promise((resolve, rejectClose) => webSockets.close((error) => error ? rejectClose(error) : resolve())); },
  };
}

function header(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function reject(socket: Duplex, status: number, message: string): void { socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`); }
