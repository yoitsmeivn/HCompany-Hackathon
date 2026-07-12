export interface OrchestratorInput {
  sessionId: string;
  computerId: string;
  text: string;
  allowedFolders: string[];
  allowedApplications: string[];
  previousResponseId?: string;
}

export interface OrchestratorResult {
  responseId?: string;
  text: string;
  // True when the orchestrator already emitted agent-speech events for this
  // response, so the voice runtime must not speak the final agent-message too.
  spoken?: boolean;
}
