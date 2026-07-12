import type { AccessPolicy } from "@/features/access/types";
import type { RuntimeEventEnvelope } from "../../shared/runtimeEvents";

export interface SendSessionMessageInput {
  sessionId: string;
  computerId: string;
  text: string;
  access: AccessPolicy;
}

export async function sendSessionMessage(input: SendSessionMessageInput): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(input.sessionId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      computerId: input.computerId,
      text: input.text,
      allowedFolders: input.access.selectedFolders,
      allowedApplications: input.access.selectedApplications,
    }),
  });
  if (!response.ok) throw new Error((await safeError(response)) ?? `Backend returned ${response.status}`);
}

export function subscribeToSessionEvents(sessionId: string, onEvent: (envelope: RuntimeEventEnvelope) => void): () => void {
  const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
  source.onmessage = (message) => {
    try { onEvent(JSON.parse(message.data) as RuntimeEventEnvelope); } catch { /* ignore malformed server events */ }
  };
  return () => source.close();
}

async function safeError(response: Response): Promise<string | undefined> {
  try { return (await response.json() as { error?: string }).error; } catch { return undefined; }
}
