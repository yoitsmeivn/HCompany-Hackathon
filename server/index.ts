import { createServer } from "node:http";
import OpenAI from "openai";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { MockComputerTaskAdapter } from "./computer/mockComputerTaskAdapter.js";
import { OpenAIOrchestrator } from "./orchestrator/openaiOrchestrator.js";
import { MockOrchestrator } from "./orchestrator/mockOrchestrator.js";
import { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "./runtime/eventHub.js";
import { OpenAIRealtimeTranscriber, OpenAISpeechSynthesizer } from "./voice/openaiVoice.js";
import { GradiumStreamingTranscriber, GradiumStreamingTts } from "./voice/gradiumVoice.js";
import { VoiceRuntime } from "./voice/voiceRuntime.js";
import { createTwilioMediaStreamServer } from "./twilio/mediaStreamServer.js";
import { ComputerRegistry } from "./computer/registry.js";

const config = loadConfig();
const events = new RuntimeEventHub();
const computer = new MockComputerTaskAdapter();
const computers = new ComputerRegistry();
if (config.executorMode === "mock") computers.register("demo-computer");
const orchestrator = config.openaiApiKey
  ? new OpenAIOrchestrator(new OpenAI({ apiKey: config.openaiApiKey }), config.openaiModel, computer, events)
  : new MockOrchestrator(computer, events);
const sessions = new SessionOrchestrationService(orchestrator, events);
const server = createServer(createApp(config, events, sessions));
const speech = config.voiceProvider === "gradium" && config.gradiumApiKey && config.gradiumTtsVoice
  ? {
      recognizer: new GradiumStreamingTranscriber({
        apiKey: config.gradiumApiKey,
        model: config.gradiumSttModel,
        language: config.gradiumSttLanguage,
        delayInFrames: config.gradiumSttDelayInFrames,
        vadHorizonSeconds: config.gradiumVadHorizonSeconds,
        vadInactivityThreshold: config.gradiumVadInactivityThreshold,
        vadConsecutiveSteps: config.gradiumVadConsecutiveSteps,
      }),
      synthesizer: new GradiumStreamingTts({ apiKey: config.gradiumApiKey, model: config.gradiumTtsModel, voiceId: config.gradiumTtsVoice }),
    }
  : config.openaiApiKey
    ? { recognizer: new OpenAIRealtimeTranscriber(config.openaiApiKey, config.voiceTranscriptionModel), synthesizer: new OpenAISpeechSynthesizer(new OpenAI({ apiKey: config.openaiApiKey }), config.voiceTtsModel, config.voiceTtsVoice) }
    : undefined;
const voice = speech && config.twilioMediaStreamUrl && config.voiceComputerId
  ? new VoiceRuntime(
      speech.recognizer,
      speech.synthesizer,
      sessions,
      events,
      (computerId) => computers.has(computerId),
    )
  : undefined;
const mediaStreams = createTwilioMediaStreamServer(config, voice);
server.on("upgrade", (request, socket, head) => {
  if (!mediaStreams.handleUpgrade(request, socket, head)) socket.destroy();
});

server.listen(config.port, () => {
  console.log(`Kylian API listening on http://localhost:${config.port} (${config.openaiApiKey ? config.openaiModel : "mock orchestrator"})`);
});
