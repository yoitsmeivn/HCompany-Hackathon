import { loadConfig } from "../config.js";
import { GradiumStreamingTts } from "./gradiumVoice.js";

const config = loadConfig();
if (!config.gradiumApiKey || !config.gradiumTtsVoice) throw new Error("GRADIUM_API_KEY and GRADIUM_TTS_VOICE are required");
const tts = new GradiumStreamingTts({
  apiKey: config.gradiumApiKey,
  model: config.gradiumTtsModel,
  voiceId: config.gradiumTtsVoice,
  speed: config.gradiumTtsSpeed,
  temperature: config.gradiumTtsTemperature,
  voiceSimilarity: config.gradiumTtsVoiceSimilarity,
  rewriteRules: config.gradiumTtsRewriteRules,
  pronunciationId: config.gradiumTtsPronunciationId,
});
let chunks = 0;
let bytes = 0;
for await (const audio of tts.synthesize({ text: "Gradium connectivity check.", callSid: "manual-redacted", streamSid: "manual-redacted" })) {
  chunks += 1;
  bytes += Buffer.from(audio, "base64").byteLength;
}
console.log(`Gradium TTS connectivity succeeded (${chunks} chunks, ${bytes} audio bytes; content redacted)`);
