import { parseAllowedRoots } from "./artifacts/artifactStore.js";

export type VoiceProvider = "gradium" | "openai";
export type ExecutorMode =
  | "mock"
  | "h-company"
  | "hai-desktop"
  | "holo-desktop"
  | "nemoclaw-desktop"
  | "local-companion";

export interface ServerConfig {
  port: number;
  publicBaseUrl: string;
  staticDir?: string;
  allowedOrigins: string[];
  openaiApiKey?: string;
  openaiModel: string;

  // H Company (Holo) OpenAI-compatible inference. When hApiKey is set the text
  // channels (WhatsApp/web) run their brain on a Holo model; voice stays on the
  // OpenAI Responses path it is tuned for.
  hApiKey?: string;
  hApiBaseUrl: string;
  hModel: string;

  // HoloDesktop CLI used by the h-company executor to drive the real desktop.
  holoCliBin: string;
  holoTaskTimeoutMs: number;

  // Local hai-agents[desktop] service used by the hai-desktop executor. The
  // URL must stay on loopback — the service is never exposed through a tunnel.
  desktopServiceUrl: string;
  desktopServiceToken?: string;
  desktopTaskTimeoutSeconds: number;

  // HoloDesktop service used by the holo-desktop executor (same HTTP contract
  // and shared bearer token as the hai service; loopback only).
  holoServiceUrl: string;
  holoTaskTimeoutSeconds: number;

  // NemoClaw-hosted HoloDesktop service used by the nemoclaw-desktop executor.
  // Same HTTP contract and shared bearer token, but the service runs inside an
  // NVIDIA NemoClaw sandbox reached over authenticated HTTPS — so this URL is
  // remote (not loopback) and must be TLS unless it is a loopback dev endpoint.
  nemoclawDesktopUrl: string;
  nemoclawDesktopTaskTimeoutSeconds: number;

  // Opt-in: forward Holo desktop screenshots to the live monitor. Default off;
  // when off no screenshot ever leaves the executor and APIs are unchanged.
  liveView: boolean;

  executorMode: ExecutorMode;
  voiceProvider: VoiceProvider;

  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioValidateSignatures: boolean;
  twilioMediaStreamUrl?: string;

  voiceComputerId?: string;
  voiceTranscriptionModel: string;
  voiceTtsModel: string;
  voiceTtsVoice: string;

  gradiumApiKey?: string;
  gradiumSttModel: string;
  gradiumTtsModel: string;
  gradiumTtsVoice?: string;
  gradiumTtsSpeed: number;
  gradiumTtsTemperature: number;
  gradiumTtsVoiceSimilarity: number;
  gradiumTtsRewriteRules?: string;
  gradiumTtsPronunciationId?: string;
  gradiumSttLanguage: string;
  gradiumSttDelayInFrames: number;
  gradiumVadHorizonSeconds: number;
  gradiumVadInactivityThreshold: number;
  gradiumVadConsecutiveSteps: number;

  nemoclawIngressToken?: string;
  nemoclawComputerId: string;
  whatsappAllowedIds: string[];

  // Twilio WhatsApp Sandbox channel (separate from voice and NemoClaw).
  kylianWhatsappEnabled: boolean;
  twilioWhatsappFrom?: string;
  kylianWhatsappDefaultTo?: string;
  twilioWhatsappWebhookUrl?: string;

  // Artifact capability system: roots the server may register files from, and
  // the per-file size cap for WhatsApp media delivery.
  kylianArtifactAllowedRoots: string[];
  kylianArtifactMaxBytes: number;

  // Owner's own email for self-addressed "email this to me" sends via Gmail
  // in the browser (HoloDesktop). Optional; required only for owner-email sends.
  kylianOwnerEmail?: string;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const port = integer(
    env.KYLIAN_API_PORT,
    8787,
    "KYLIAN_API_PORT",
    1,
    65535,
  );

  const gradiumConfigured = Boolean(
    env.GRADIUM_API_KEY && env.GRADIUM_TTS_VOICE,
  );

  const config: ServerConfig = {
    port,
    publicBaseUrl:
      env.KYLIAN_PUBLIC_BASE_URL ?? `http://localhost:${port}`,
    staticDir: env.KYLIAN_STATIC_DIR,
    allowedOrigins: stringList(env.KYLIAN_ALLOWED_ORIGINS, [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]),

    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL ?? "gpt-5.4-mini",

    hApiKey: optionalString(env.HAI_API_KEY),
    hApiBaseUrl: env.H_API_BASE_URL ?? "https://api.hcompany.ai/v1",
    hModel: env.H_MODEL ?? "holo3-1-35b-a3b",

    holoCliBin: env.HOLO_CLI_BIN ?? "holo",
    holoTaskTimeoutMs: integer(
      env.HOLO_TASK_TIMEOUT_MS,
      180_000,
      "HOLO_TASK_TIMEOUT_MS",
      1_000,
      1_800_000,
    ),

    desktopServiceUrl:
      env.KYLIAN_DESKTOP_SERVICE_URL ?? "http://127.0.0.1:8790",
    desktopServiceToken: optionalString(
      env.KYLIAN_DESKTOP_SERVICE_TOKEN,
    ),
    desktopTaskTimeoutSeconds: integer(
      env.KYLIAN_DESKTOP_TASK_TIMEOUT_S,
      120,
      "KYLIAN_DESKTOP_TASK_TIMEOUT_S",
      10,
      900,
    ),

    holoServiceUrl:
      env.KYLIAN_HOLO_SERVICE_URL ?? "http://127.0.0.1:8792",
    holoTaskTimeoutSeconds: integer(
      env.KYLIAN_HOLO_TASK_TIMEOUT_S,
      240,
      "KYLIAN_HOLO_TASK_TIMEOUT_S",
      10,
      900,
    ),

    nemoclawDesktopUrl:
      env.KYLIAN_NEMOCLAW_DESKTOP_URL ?? "http://127.0.0.1:8792",
    nemoclawDesktopTaskTimeoutSeconds: integer(
      env.KYLIAN_NEMOCLAW_DESKTOP_TASK_TIMEOUT_S,
      240,
      "KYLIAN_NEMOCLAW_DESKTOP_TASK_TIMEOUT_S",
      10,
      900,
    ),

    liveView: booleanValue(
      env.KYLIAN_LIVE_VIEW,
      false,
      "KYLIAN_LIVE_VIEW",
    ),

    executorMode: enumValue(
      env.KYLIAN_EXECUTOR_MODE,
      [
        "mock",
        "h-company",
        "hai-desktop",
        "holo-desktop",
        "nemoclaw-desktop",
        "local-companion",
      ] as const,
      "mock",
      "KYLIAN_EXECUTOR_MODE",
    ),

    voiceProvider: enumValue(
      env.KYLIAN_VOICE_PROVIDER,
      ["gradium", "openai"] as const,
      gradiumConfigured ? "gradium" : "openai",
      "KYLIAN_VOICE_PROVIDER",
    ),

    twilioAccountSid: env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: env.TWILIO_PHONE_NUMBER,
    twilioValidateSignatures: booleanValue(
      env.TWILIO_VALIDATE_SIGNATURES,
      true,
      "TWILIO_VALIDATE_SIGNATURES",
    ),
    twilioMediaStreamUrl: env.TWILIO_MEDIA_STREAM_URL,

    voiceComputerId: env.KYLIAN_VOICE_COMPUTER_ID,
    voiceTranscriptionModel:
      env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
    voiceTtsModel: env.OPENAI_TTS_MODEL ?? "tts-1",
    voiceTtsVoice: env.OPENAI_TTS_VOICE ?? "alloy",

    gradiumApiKey: env.GRADIUM_API_KEY,
    gradiumSttModel: env.GRADIUM_STT_MODEL ?? "default",
    gradiumTtsModel: env.GRADIUM_TTS_MODEL ?? "default",
    gradiumTtsVoice: env.GRADIUM_TTS_VOICE,
    gradiumTtsSpeed: numberValue(
      optionalString(env.GRADIUM_TTS_SPEED),
      -1.0,
      "GRADIUM_TTS_SPEED",
      -4,
      4,
    ),
    gradiumTtsTemperature: numberValue(
      optionalString(env.GRADIUM_TTS_TEMPERATURE),
      0.5,
      "GRADIUM_TTS_TEMPERATURE",
      0,
      1.4,
    ),
    gradiumTtsVoiceSimilarity: numberValue(
      optionalString(env.GRADIUM_TTS_VOICE_SIMILARITY),
      2.0,
      "GRADIUM_TTS_VOICE_SIMILARITY",
      1,
      4,
    ),
    gradiumTtsRewriteRules: optionalString(
      env.GRADIUM_TTS_REWRITE_RULES,
    ),
    gradiumTtsPronunciationId: optionalString(
      env.GRADIUM_TTS_PRONUNCIATION_ID,
    ),
    gradiumSttLanguage: env.GRADIUM_STT_LANGUAGE ?? "en",
    gradiumSttDelayInFrames: integer(
      env.GRADIUM_STT_DELAY_IN_FRAMES,
      8,
      "GRADIUM_STT_DELAY_IN_FRAMES",
      0,
      80,
    ),
    gradiumVadHorizonSeconds: numberValue(
      env.GRADIUM_VAD_HORIZON_SECONDS,
      1,
      "GRADIUM_VAD_HORIZON_SECONDS",
      0,
    ),
    gradiumVadInactivityThreshold: numberValue(
      env.GRADIUM_VAD_INACTIVITY_THRESHOLD,
      0.5,
      "GRADIUM_VAD_INACTIVITY_THRESHOLD",
      0,
      1,
    ),
    gradiumVadConsecutiveSteps: integer(
      env.GRADIUM_VAD_CONSECUTIVE_STEPS,
      2,
      "GRADIUM_VAD_CONSECUTIVE_STEPS",
      1,
      20,
    ),

    nemoclawIngressToken: env.NEMOCLAW_INGRESS_TOKEN,
    nemoclawComputerId:
      env.NEMOCLAW_COMPUTER_ID ??
      env.KYLIAN_VOICE_COMPUTER_ID ??
      "demo-computer",

    whatsappAllowedIds: stringList(
      env.WHATSAPP_ALLOWED_IDS,
      [],
    ),

    kylianWhatsappEnabled: booleanValue(
      env.KYLIAN_WHATSAPP_ENABLED,
      false,
      "KYLIAN_WHATSAPP_ENABLED",
    ),
    twilioWhatsappFrom: optionalString(
      env.TWILIO_WHATSAPP_FROM,
    ),
    kylianWhatsappDefaultTo: optionalString(
      env.KYLIAN_WHATSAPP_DEFAULT_TO,
    ),
    twilioWhatsappWebhookUrl: optionalString(
      env.TWILIO_WHATSAPP_WEBHOOK_URL,
    ),

    kylianArtifactAllowedRoots: parseAllowedRoots(
      env.KYLIAN_ARTIFACT_ALLOWED_ROOTS,
    ),
    kylianArtifactMaxBytes: integer(
      env.KYLIAN_ARTIFACT_MAX_BYTES,
      15_728_640,
      "KYLIAN_ARTIFACT_MAX_BYTES",
      1024,
      104_857_600,
    ),

    kylianOwnerEmail: optionalString(
      env.KYLIAN_OWNER_EMAIL,
    ),
  };

  validateConfig(config, env);
  return config;
}

function validateConfig(
  config: ServerConfig,
  env: NodeJS.ProcessEnv,
): void {
  // In production the NemoClaw/WhatsApp ingress must not be open. Gated on
  // NODE_ENV, not executorMode, so dev and test configs remain usable.
  if (
    env.NODE_ENV === "production" &&
    !config.nemoclawIngressToken
  ) {
    throw new Error(
      "NEMOCLAW_INGRESS_TOKEN is required in production (NODE_ENV=production)",
    );
  }

  const loopback = [
    "127.0.0.1",
    "localhost",
    "::1",
    "[::1]",
  ];

  if (
    config.executorMode === "hai-desktop" ||
    config.executorMode === "holo-desktop"
  ) {
    if (!config.desktopServiceToken) {
      throw new Error(
        `KYLIAN_DESKTOP_SERVICE_TOKEN is required when KYLIAN_EXECUTOR_MODE=${config.executorMode}`,
      );
    }

    if (
      !loopback.includes(
        new URL(config.desktopServiceUrl).hostname,
      )
    ) {
      throw new Error(
        "KYLIAN_DESKTOP_SERVICE_URL must stay on loopback " +
          "(the desktop service is never exposed publicly)",
      );
    }

    if (
      !loopback.includes(
        new URL(config.holoServiceUrl).hostname,
      )
    ) {
      throw new Error(
        "KYLIAN_HOLO_SERVICE_URL must stay on loopback " +
          "(the desktop service is never exposed publicly)",
      );
    }
  }

  if (config.executorMode === "nemoclaw-desktop") {
    // The Holo service runs inside a remote NemoClaw sandbox, reached over
    // authenticated HTTPS. Require the shared token, and require TLS for any
    // non-loopback host. Plain HTTP is allowed only for loopback development.
    if (!config.desktopServiceToken) {
      throw new Error(
        "KYLIAN_DESKTOP_SERVICE_TOKEN is required when KYLIAN_EXECUTOR_MODE=nemoclaw-desktop",
      );
    }

    const url = new URL(config.nemoclawDesktopUrl);

    if (
      !loopback.includes(url.hostname) &&
      url.protocol !== "https:"
    ) {
      throw new Error(
        "KYLIAN_NEMOCLAW_DESKTOP_URL must be https:// for a remote NemoClaw sandbox " +
          "(plain http is only allowed on loopback)",
      );
    }
  }

  if (
    config.kylianOwnerEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      config.kylianOwnerEmail,
    )
  ) {
    throw new Error(
      "KYLIAN_OWNER_EMAIL must be a valid email address",
    );
  }

  if (config.kylianWhatsappEnabled) {
    const whatsappAddress =
      /^whatsapp:\+[1-9]\d{6,14}$/;

    if (!config.twilioAccountSid) {
      throw new Error(
        "TWILIO_ACCOUNT_SID is required when KYLIAN_WHATSAPP_ENABLED=true",
      );
    }

    if (!config.twilioAuthToken) {
      throw new Error(
        "TWILIO_AUTH_TOKEN is required when KYLIAN_WHATSAPP_ENABLED=true",
      );
    }

    if (
      !config.twilioWhatsappFrom ||
      !whatsappAddress.test(
        config.twilioWhatsappFrom,
      )
    ) {
      throw new Error(
        "TWILIO_WHATSAPP_FROM must be a whatsapp:+E164 address when " +
          "KYLIAN_WHATSAPP_ENABLED=true",
      );
    }

    if (
      !config.kylianWhatsappDefaultTo ||
      !whatsappAddress.test(
        config.kylianWhatsappDefaultTo,
      )
    ) {
      throw new Error(
        "KYLIAN_WHATSAPP_DEFAULT_TO must be a whatsapp:+E164 address when " +
          "KYLIAN_WHATSAPP_ENABLED=true",
      );
    }

    if (config.twilioWhatsappWebhookUrl) {
      const url = new URL(
        config.twilioWhatsappWebhookUrl,
      );

      if (
        url.protocol !== "https:" ||
        url.pathname !== "/api/twilio/whatsapp" ||
        url.search
      ) {
        throw new Error(
          "TWILIO_WHATSAPP_WEBHOOK_URL must be a public https:// URL ending in " +
            "/api/twilio/whatsapp with no query string",
        );
      }
    }
  }

  if (config.twilioMediaStreamUrl) {
    const url = new URL(
      config.twilioMediaStreamUrl,
    );

    if (
      url.protocol !== "wss:" ||
      url.pathname !== "/twilio/media-stream" ||
      url.search
    ) {
      throw new Error(
        "TWILIO_MEDIA_STREAM_URL must be a public wss:// URL ending in " +
          "/twilio/media-stream with no query string",
      );
    }
  }

  const twilioEnabled = Boolean(
    config.twilioAuthToken ||
      config.twilioMediaStreamUrl,
  );

  if (
    config.twilioAuthToken &&
    !config.twilioMediaStreamUrl
  ) {
    throw new Error(
      "TWILIO_MEDIA_STREAM_URL is required when TWILIO_AUTH_TOKEN is configured",
    );
  }

  if (
    config.twilioMediaStreamUrl &&
    config.twilioValidateSignatures &&
    !config.twilioAuthToken
  ) {
    throw new Error(
      "TWILIO_AUTH_TOKEN is required when Twilio signature validation is enabled",
    );
  }

  if (
    twilioEnabled &&
    !config.openaiApiKey
  ) {
    throw new Error(
      "OPENAI_API_KEY is required for Kylian orchestration when voice is configured",
    );
  }

  if (
    twilioEnabled &&
    !config.voiceComputerId
  ) {
    throw new Error(
      "KYLIAN_VOICE_COMPUTER_ID is required for the configured voice transport",
    );
  }

  if (
    config.voiceProvider === "gradium" &&
    !config.gradiumApiKey
  ) {
    throw new Error(
      "GRADIUM_API_KEY is required when KYLIAN_VOICE_PROVIDER=gradium",
    );
  }

  if (
    config.voiceProvider === "gradium" &&
    !config.gradiumTtsVoice
  ) {
    throw new Error(
      "GRADIUM_TTS_VOICE is required when KYLIAN_VOICE_PROVIDER=gradium",
    );
  }
}

function optionalString(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function stringList(
  value: string | undefined,
  fallback: string[],
): string[] {
  if (
    value === undefined ||
    !value.trim()
  ) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function integer(
  value: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number,
): number {
  const parsed =
    value === undefined
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${name} must be an integer from ${min} to ${max}`,
    );
  }

  return parsed;
}

function numberValue(
  value: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max = Number.POSITIVE_INFINITY,
): number {
  const parsed =
    value === undefined
      ? fallback
      : Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${name} must be a number from ${min} to ${max}`,
    );
  }

  return parsed;
}

function booleanValue(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(
    `${name} must be true or false`,
  );
}

function enumValue<
  const T extends readonly string[],
>(
  value: string | undefined,
  values: T,
  fallback: T[number],
  name: string,
): T[number] {
  const candidate = value ?? fallback;

  if (!values.includes(candidate)) {
    throw new Error(
      `${name} must be one of: ${values.join(", ")}`,
    );
  }

  return candidate as T[number];
}