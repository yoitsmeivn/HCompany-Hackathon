import { z } from "zod";

const sid = z.string().min(2).max(128);
const sequence = z.string().regex(/^\d+$/);
const strictRecord = z.record(z.string(), z.string());

const connected = z.object({ event: z.literal("connected"), protocol: z.literal("Call"), version: z.string().min(1) }).strict();
const start = z.object({
  event: z.literal("start"), sequenceNumber: sequence, streamSid: sid,
  start: z.object({
    streamSid: sid, accountSid: sid, callSid: sid,
    tracks: z.array(z.enum(["inbound", "outbound"])).min(1),
    customParameters: strictRecord,
    mediaFormat: z.object({ encoding: z.literal("audio/x-mulaw"), sampleRate: z.literal(8000), channels: z.literal(1) }).strict(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.streamSid !== value.start.streamSid) context.addIssue({ code: "custom", message: "streamSid values must match" });
});
const media = z.object({
  event: z.literal("media"), sequenceNumber: sequence, streamSid: sid,
  media: z.object({ track: z.enum(["inbound", "outbound"]), chunk: sequence, timestamp: sequence, payload: z.string().min(1).max(2_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
}).strict();
const mark = z.object({ event: z.literal("mark"), sequenceNumber: sequence, streamSid: sid, mark: z.object({ name: z.string().min(1).max(256) }).strict() }).strict();
const stop = z.object({ event: z.literal("stop"), sequenceNumber: sequence, streamSid: sid, stop: z.object({ accountSid: sid, callSid: sid }).strict() }).strict();

export const twilioMediaInboundSchema = z.discriminatedUnion("event", [connected, start, media, mark, stop]);
export type TwilioMediaInbound = z.infer<typeof twilioMediaInboundSchema>;

export type TwilioMediaOutbound =
  | { event: "media"; streamSid: string; media: { payload: string } }
  | { event: "mark"; streamSid: string; mark: { name: string } }
  | { event: "clear"; streamSid: string };

export function parseTwilioMediaMessage(raw: string): TwilioMediaInbound {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Twilio media message must be valid JSON"); }
  return twilioMediaInboundSchema.parse(value);
}

export function frameOutboundAudio(streamSid: string, audio: Uint8Array): [TwilioMediaOutbound, TwilioMediaOutbound] {
  if (!streamSid || audio.byteLength === 0) throw new Error("streamSid and audio are required");
  const markName = `audio-${Date.now()}`;
  return [
    { event: "media", streamSid, media: { payload: Buffer.from(audio).toString("base64") } },
    { event: "mark", streamSid, mark: { name: markName } },
  ];
}

export function frameOutboundPayload(streamSid: string, payload: string): TwilioMediaOutbound {
  if (!streamSid || !payload) throw new Error("streamSid and payload are required");
  return { event: "media", streamSid, media: { payload } };
}

export function frameOutboundMark(streamSid: string, name = `audio-${Date.now()}`): TwilioMediaOutbound {
  if (!streamSid || !name) throw new Error("streamSid and mark name are required");
  return { event: "mark", streamSid, mark: { name } };
}

export function frameOutboundClear(streamSid: string): TwilioMediaOutbound {
  if (!streamSid) throw new Error("streamSid is required");
  return { event: "clear", streamSid };
}
