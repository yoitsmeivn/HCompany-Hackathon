import type { ID } from "@/types/common";
import * as persistence from "@/store/persistence";
import { resolve } from "./api";

export interface StoredPreferences {
  activeComputerId: ID | null;
  preferences: { channel: string; name: string; phone: string; smsConsent: boolean };
}

// Local adapter — future: GET /api/preferences (or part of a session bootstrap)
export function get(): Promise<StoredPreferences> {
  const snapshot = persistence.load();
  return resolve({
    activeComputerId: snapshot?.activeComputerId ?? null,
    preferences: snapshot?.preferences ?? {
      channel: "Phone",
      name: "",
      phone: "",
      smsConsent: false,
    },
  });
}
