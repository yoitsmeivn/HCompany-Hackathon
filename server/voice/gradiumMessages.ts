import { z } from "zod";

const streamId = z.number().int().nullable().optional();
const ready = z.object({
  type: z.literal("ready"), request_id: z.string().min(1), model_name: z.string().optional(), model_ext: z.string().optional(),
  sample_rate: z.number().int().positive().optional(), frame_size: z.number().int().positive().optional(), delay_in_frames: z.number().int().nonnegative().optional(),
  audio_stream_names: z.array(z.string()).optional(), text_stream_names: z.array(z.string()).optional(), client_req_id: z.string().optional(),
}).strict();
const text = z.object({ type: z.literal("text"), text: z.string(), start_s: z.number().nonnegative().optional(), stop_s: z.number().nonnegative().optional(), stream_id: streamId, client_req_id: z.string().optional() }).strict();
const endText = z.object({ type: z.literal("end_text"), stop_s: z.number().nonnegative(), stream_id: streamId, client_req_id: z.string().optional() }).strict();
const step = z.object({
  type: z.literal("step"), vad: z.array(z.object({ horizon_s: z.number().nonnegative(), inactivity_prob: z.number().min(0).max(1) }).strict()),
  step_idx: z.number().int().nonnegative(), step_duration_s: z.number().positive(), total_duration_s: z.number().nonnegative().optional(), client_req_id: z.string().optional(),
}).strict();
const flushed = z.object({ type: z.literal("flushed"), flush_id: z.number().int().nonnegative(), client_req_id: z.string().optional() }).strict();
const eos = z.object({ type: z.literal("end_of_stream"), client_req_id: z.string().optional() }).strict();
const error = z.object({ type: z.literal("error"), message: z.string().min(1), code: z.number().int().optional(), client_req_id: z.string().optional() }).strict();
const audio = z.object({ type: z.literal("audio"), audio: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/), start_s: z.number().nonnegative().optional(), stop_s: z.number().nonnegative().optional(), stream_id: streamId, client_req_id: z.string().optional() }).strict();

export const gradiumSttMessageSchema = z.discriminatedUnion("type", [ready, text, endText, step, flushed, eos, error]);
export const gradiumTtsMessageSchema = z.discriminatedUnion("type", [ready, audio, text, flushed, eos, error]);
export type GradiumSttMessage = z.infer<typeof gradiumSttMessageSchema>;
export type GradiumTtsMessage = z.infer<typeof gradiumTtsMessageSchema>;

export function parseGradiumSttMessage(raw: string): GradiumSttMessage { return gradiumSttMessageSchema.parse(parseJson(raw)); }
export function parseGradiumTtsMessage(raw: string): GradiumTtsMessage { return gradiumTtsMessageSchema.parse(parseJson(raw)); }

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new Error("Gradium message must be valid JSON"); }
}
