import type { MonitorEventEnvelope } from "../../shared/runtimeEvents";

export interface ServerRuntimeConfig {
  voiceComputerId: string | null;
  twilioPhoneNumber: string | null;
  voiceConfigured: boolean;
}

export interface OwnerPolicy {
  ownerName: string;
  authorizedPhone: string;
  allowedFolders: string[];
  allowedApplications: string[];
}

// Public runtime facts (Twilio number, computer id) the monitoring UI displays.
export async function getServerConfig(): Promise<ServerRuntimeConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return (await response.json()) as ServerRuntimeConfig;
}

// Push the owner's identity, authorized caller, and access to the backend so
// the voice pipeline can enforce them when a call lands.
export async function saveOwnerPolicy(computerId: string, policy: OwnerPolicy): Promise<void> {
  const response = await fetch(`/api/computers/${encodeURIComponent(computerId)}/policy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
}

// Dev-only: ask the backend (in mock mode) to fake an inbound call so the
// monitoring → live-session handoff can be demoed without real telephony.
export async function simulateCall(input: { from?: string; text?: string } = {}): Promise<void> {
  const response = await fetch("/api/monitor/simulate-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
}

// Subscribe to the global call-lifecycle stream while sitting in monitoring.
export function subscribeToMonitor(onEvent: (envelope: MonitorEventEnvelope) => void): () => void {
  const source = new EventSource("/api/monitor/events");
  source.onmessage = (message) => {
    try { onEvent(JSON.parse(message.data) as MonitorEventEnvelope); } catch { /* ignore malformed events */ }
  };
  return () => source.close();
}
