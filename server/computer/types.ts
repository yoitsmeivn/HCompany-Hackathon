export interface ComputerTaskRequest {
  sessionId: string;
  computerId: string;
  instruction: string;
  allowedFolders: string[];
  allowedApplications: string[];
}

export interface ComputerTaskResult {
  taskId: string;
  status: "completed" | "waiting_for_approval" | "failed";
  summary: string;
  candidates?: Array<{ name: string; meta: string; ext: string; evidence?: string }>;
  approval?: { summary: string; fileName: string };
  // Files the desktop agent reported via the structured ARTIFACTS_JSON marker.
  // The server validates each localPath before turning it into a capability;
  // the model never receives these paths.
  artifacts?: Array<{ localPath: string; displayName: string }>;
}

export interface ComputerTaskAdapter {
  readonly provider: "mock" | "h-company" | "hai-desktop" | "holo-desktop" | "nemoclaw-desktop" | "local-companion";
  run(request: ComputerTaskRequest): Promise<ComputerTaskResult>;
  steer(taskId: string, instruction: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  stop(taskId: string): Promise<void>;
}
