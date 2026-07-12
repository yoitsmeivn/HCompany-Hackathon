export interface OrchestratorInput {
  sessionId: string;
  computerId: string;
  text: string;
  allowedFolders: string[];
  allowedApplications: string[];
  previousResponseId?: string;
  // Which channel the message arrived on. Voice stays on the OpenAI Responses
  // brain it is tuned for; text channels (WhatsApp/web) may use the Holo brain.
  // Undefined is treated as "text".
  channel?: "voice" | "text";
}

export interface OrchestratorResult {
  responseId?: string;
  text: string;
  // True when the orchestrator already emitted agent-speech events for this
  // response, so the voice runtime must not speak the final agent-message too.
  spoken?: boolean;
}
