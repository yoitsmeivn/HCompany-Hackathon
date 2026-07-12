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
}
