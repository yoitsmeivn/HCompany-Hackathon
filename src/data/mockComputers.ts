import type { Computer } from "@/features/devices/types";

export const MOCK_COMPUTERS: Computer[] = [
  {
    id: "mac-ivan",
    name: "Ivan’s MacBook Pro",
    model: "MacBook Pro 14″",
    os: "macOS",
    status: "online",
    lastSeen: "Just now",
    access: {
      mode: "ask",
      selectedFolders: ["Desktop", "Documents", "Downloads"],
      selectedApplications: ["Finder", "Preview"],
      voiceEnabled: true,
      liveViewEnabled: true,
      allowFileDelivery: false,
    },
  },
  {
    id: "imac-studio",
    name: "Studio iMac",
    model: "iMac 24″",
    os: "macOS",
    status: "offline",
    lastSeen: "Yesterday",
    access: {
      mode: "selected",
      selectedFolders: ["Documents"],
      selectedApplications: ["Finder"],
      voiceEnabled: false,
      liveViewEnabled: true,
      allowFileDelivery: false,
    },
  },
];
