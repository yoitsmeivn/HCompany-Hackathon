import { createServer } from "node:http";
import OpenAI from "openai";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createComputerAdapter } from "./computer/createComputerAdapter.js";
import { OpenAIOrchestrator } from "./orchestrator/openaiOrchestrator.js";
import { HoloOrchestrator } from "./orchestrator/holoOrchestrator.js";
import { MockOrchestrator } from "./orchestrator/mockOrchestrator.js";
import type { Orchestrator } from "./orchestrator/sessionOrchestrationService.js";
import { SessionOrchestrationService } from "./orchestrator/sessionOrchestrationService.js";
import { RuntimeEventHub } from "./runtime/eventHub.js";
import { PolicyStore } from "./runtime/policyStore.js";
import { OpenAIRealtimeTranscriber, OpenAISpeechSynthesizer } from "./voice/openaiVoice.js";
import { GradiumStreamingTranscriber } from "./voice/gradiumVoice.js";
import { GradiumTtsSession } from "./voice/gradiumTtsSession.js";
import { VoiceRuntime } from "./voice/voiceRuntime.js";
import { createTwilioMediaStreamServer } from "./twilio/mediaStreamServer.js";
import { ComputerRegistry } from "./computer/registry.js";
import { WhatsAppSender } from "./twilio/whatsappSender.js";
import { ArtifactStore } from "./artifacts/artifactStore.js";
import { ArtifactPublisher } from "./artifacts/artifactPublisher.js";
import { ZipService } from "./artifacts/zipService.js";

const config = loadConfig();
const events = new RuntimeEventHub();
const computer = createComputerAdapter(config, events);
const computers = new ComputerRegistry();
// Register the demo/voice computer id so voice and simulate-call can reach it.
// In mock mode this is the fixed "demo-computer"; in h-company mode it is the
// configured voice/NemoClaw computer the real executor drives.
if (config.executorMode === "mock") computers.register("demo-computer");
else computers.register(config.voiceComputerId ?? config.nemoclawComputerId);

// Outbound WhatsApp (Twilio Sandbox) — built only when the channel is enabled.
const whatsapp = config.kylianWhatsappEnabled ? new WhatsAppSender(config) : undefined;
// Artifact capabilities: server-validated file handles + single-use signed
// delivery URLs on the existing tunnel (never the local filesystem directly).
const artifacts = new ArtifactStore(config.kylianArtifactAllowedRoots, config.kylianArtifactMaxBytes);
const artifactPublisher = new ArtifactPublisher(artifacts, config.publicBaseUrl);
const zipService = new ZipService(artifacts, config.kylianArtifactMaxBytes);
// Voice brain: OpenAI Responses (tuned for low-latency streaming) or mock.
const voiceOrchestrator: Orchestrator = config.openaiApiKey
  ? new OpenAIOrchestrator(new OpenAI({ apiKey: config.openaiApiKey }), config.openaiModel, computer, events, whatsapp, { artifacts, publisher: artifactPublisher, zip: zipService }, config.kylianOwnerEmail)
  : new MockOrchestrator(computer, events);
// Text brain (WhatsApp/web): H Company Holo via its OpenAI-compatible Chat
// Completions API when HAI_API_KEY is set; otherwise reuse the voice brain.
const textOrchestrator: Orchestrator | undefined = config.hApiKey
  ? new HoloOrchestrator(new OpenAI({ apiKey: config.hApiKey, baseURL: config.hApiBaseUrl }), config.hModel, computer, events)
  : undefined;
const sessions = new SessionOrchestrationService(voiceOrchestrator, events, textOrchestrator);
const policies = new PolicyStore();
const server = createServer(createApp(config, events, sessions, policies, undefined, whatsapp, artifactPublisher));
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
      synthesizer: new GradiumTtsSession({
        apiKey: config.gradiumApiKey,
        model: config.gradiumTtsModel,
        voiceId: config.gradiumTtsVoice,
        speed: config.gradiumTtsSpeed,
        temperature: config.gradiumTtsTemperature,
        voiceSimilarity: config.gradiumTtsVoiceSimilarity,
        rewriteRules: config.gradiumTtsRewriteRules,
        pronunciationId: config.gradiumTtsPronunciationId,
      }),
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
      (computerId) => policies.get(computerId),
    )
  : undefined;
const mediaStreams = createTwilioMediaStreamServer(config, voice);
server.on("upgrade", (request, socket, head) => {
  if (!mediaStreams.handleUpgrade(request, socket, head)) socket.destroy();
});

server.listen(config.port, () => {
  const voiceBrain = config.openaiApiKey ? `openai:${config.openaiModel}` : "mock";
  const textBrain = config.hApiKey ? `holo:${config.hModel}` : voiceBrain;
  console.log(
    `Kylian API listening on http://localhost:${config.port} ` +
      `(voice brain: ${voiceBrain}, text brain: ${textBrain}, executor: ${config.executorMode})`,
  );
});
