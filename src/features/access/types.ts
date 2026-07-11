export type AccessMode = "full" | "selected" | "ask";

export interface AccessPolicy {
  mode: AccessMode;
  selectedFolders: string[];
  selectedApplications: string[];
  voiceEnabled: boolean;
  liveViewEnabled: boolean;
  allowFileDelivery: boolean;
}

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  full: "Full access",
  selected: "Selected access",
  ask: "Ask every time",
};

export const ACCESS_MODE_DESCRIPTIONS: Record<AccessMode, string> = {
  full: "Kylian can access files and applications on this computer during an active session.",
  selected: "You choose the folders and applications Kylian may access.",
  ask: "Kylian asks for permission before opening each new folder or application.",
};

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  mode: "ask",
  selectedFolders: ["Desktop", "Documents", "Downloads"],
  selectedApplications: ["Finder", "Preview"],
  voiceEnabled: true,
  liveViewEnabled: true,
  allowFileDelivery: false,
};
