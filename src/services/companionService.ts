export interface CompanionInfo {
  computerName: string;
  version: string;
}

// Future boundary for the local Kylian companion (WebSocket / local HTTP
// probe). There is no companion integration yet, so detection honestly
// reports none — the UI must never claim a companion is connected unless one
// actually is. Connection events will arrive through
// src/integrations/runtimeEvents.ts.
export function detectCompanion(): Promise<CompanionInfo | null> {
  return Promise.resolve(null);
}
