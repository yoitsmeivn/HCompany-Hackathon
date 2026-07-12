import { z } from "zod";

// Provider->client schemas are deliberately non-strict: the live Gradium API
// sends additive metadata (e.g. audio_tokens) and client_req_id as null when
// no client request id was supplied. Unknown keys are stripped, never fatal.
const streamId = z.number().int().nullable().optional();
const clientReqId = z.string().nullable().optional();
const ready = z.object({
  type: z.literal("ready"), request_id: z.string().min(1), model_name: z.string().optional(), model_ext: z.string().optional(),
  sample_rate: z.number().int().positive().optional(), frame_size: z.number().int().positive().optional(), delay_in_frames: z.number().int().nonnegative().optional(),
  audio_stream_names: z.array(z.string()).optional(), text_stream_names: z.array(z.string()).optional(), client_req_id: clientReqId,
});
const text = z.object({ type: z.literal("text"), text: z.string(), start_s: z.number().nonnegative().optional(), stop_s: z.number().nonnegative().optional(), stream_id: streamId, client_req_id: clientReqId });
const endText = z.object({ type: z.literal("end_text"), stop_s: z.number().nonnegative(), stream_id: streamId, client_req_id: clientReqId });
const step = z.object({
  type: z.literal("step"), vad: z.array(z.object({ horizon_s: z.number().nonnegative(), inactivity_prob: z.number().min(0).max(1) })),
  step_idx: z.number().int().nonnegative(), step_duration_s: z.number().positive(), total_duration_s: z.number().nonnegative().optional(), client_req_id: clientReqId,
});
const flushed = z.object({ type: z.literal("flushed"), flush_id: z.number().int().nonnegative(), client_req_id: clientReqId });
const eos = z.object({ type: z.literal("end_of_stream"), client_req_id: clientReqId });
const error = z.object({ type: z.literal("error"), message: z.string().min(1), code: z.number().int().optional(), client_req_id: clientReqId });
const audio = z.object({
  type: z.literal("audio"), audio: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/), start_s: z.number().nonnegative().optional(), stop_s: z.number().nonnegative().optional(),
  stream_id: streamId, audio_tokens: z.array(z.unknown()).optional(), client_req_id: clientReqId,
});

export const gradiumSttMessageSchema = z.discriminatedUnion("type", [ready, text, endText, step, flushed, eos, error]);
export const gradiumTtsMessageSchema = z.discriminatedUnion("type", [ready, audio, text, flushed, eos, error]);
export type GradiumSttMessage = z.infer<typeof gradiumSttMessageSchema>;
export type GradiumTtsMessage = z.infer<typeof gradiumTtsMessageSchema>;

const STT_TYPES = new Set(["ready", "text", "end_text", "step", "flushed", "end_of_stream", "error"]);
const TTS_TYPES = new Set(["ready", "audio", "text", "flushed", "end_of_stream", "error"]);

export function parseGradiumSttMessage(raw: string): GradiumSttMessage {
  return parseGradiumMessage(raw, "STT", gradiumSttMessageSchema, STT_TYPES);
}
export function parseGradiumTtsMessage(raw: string): GradiumTtsMessage {
  return parseGradiumMessage(raw, "TTS", gradiumTtsMessageSchema, TTS_TYPES);
}

function parseGradiumMessage<T>(raw: string, channel: "STT" | "TTS", schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, knownTypes: Set<string>): T {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`Gradium ${channel} message must be valid JSON`); }
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const type = messageType(value);
  if (type === undefined || !knownTypes.has(type)) throw new Error(`Gradium ${channel} unsupported message type: ${type ?? "<missing>"}`);
  throw new Error(`Gradium ${channel} ${type} message failed validation; keys=${describeShape(value)}`);
}

function messageType(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

// Safe for logs: key names only, never values.
function describeShape(value: unknown): string {
  if (!value || typeof value !== "object") return `<${typeof value}>`;
  return Object.keys(value).sort().join(",");
}
