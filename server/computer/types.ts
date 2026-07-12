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
}

export interface ComputerTaskAdapter {
  readonly provider: "mock" | "h-company" | "hai-desktop" | "holo-desktop" | "local-companion";
  run(request: ComputerTaskRequest): Promise<ComputerTaskResult>;
  steer(taskId: string, instruction: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  stop(taskId: string): Promise<void>;
}
