import type { Computer } from "@/features/devices/types";
import type { Session } from "@/features/sessions/types";
import type { FileItem } from "@/features/files/types";
import type { LiveSessionData } from "@/features/live-session/types";
import type { ID } from "@/types/common";

export interface DemoFixture {
  computers: Computer[];
  sessions: Session[];
  files: FileItem[];
  live: Record<ID, LiveSessionData>;
  activeComputerId: ID | null;
}

// Generic sample data, loaded ONLY through the explicit "Load demo data"
// action in the UI. Never used as fallback or default state.
export function buildDemoFixture(now: number): DemoFixture {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  return {
    activeComputerId: "demo-computer-1",
    computers: [
      {
        id: "demo-computer-1",
        name: "Home MacBook",
        model: "MacBook Pro 14″",
        os: "macOS",
        status: "connected",
        lastSeenAt: ago(0),
        access: {
          mode: "ask",
          selectedFolders: ["Desktop", "Documents", "Downloads"],
          selectedApplications: ["Finder", "Preview"],
          voiceEnabled: true,
          liveViewEnabled: true,
          allowFileDelivery: false,
        },
      },
    ],
    sessions: [
      {
        id: "demo-session-1",
        name: "Find the latest quarterly report",
        detail: "Comparing two candidate files",
        lastActiveAt: ago(1),
        computerId: "demo-computer-1",
        status: "Active",
        state: "active",
        accessMode: "ask",
      },
      {
        id: "demo-session-2",
        name: "Send the signed contract",
        detail: "Waiting for your approval",
        lastActiveAt: ago(9),
        computerId: "demo-computer-1",
        status: "Waiting",
        state: "waiting",
        accessMode: "selected",
      },
      {
        id: "demo-session-3",
        name: "Locate the team offsite photos",
        detail: "Delivered via secure link",
        lastActiveAt: ago(60 * 26),
        computerId: "demo-computer-1",
        status: "Complete",
        state: "complete",
        accessMode: "ask",
      },
    ],
    files: [
      {
        id: "demo-file-1",
        name: "Quarterly_Report_Q2.pdf",
        kind: "pdf",
        location: "Documents › Reports",
        computerId: "demo-computer-1",
        lastAccessedAt: ago(1),
        action: "opened",
        status: "available",
        source: "demo",
        sessionId: "demo-session-1",
      },
      {
        id: "demo-file-2",
        name: "Quarterly_Report_Q2_draft.pdf",
        kind: "pdf",
        location: "Documents › Reports",
        computerId: "demo-computer-1",
        lastAccessedAt: ago(2),
        action: "previewed",
        status: "available",
        source: "demo",
        sessionId: "demo-session-1",
      },
      {
        id: "demo-file-3",
        name: "Contract_signed.pdf",
        kind: "pdf",
        location: "Desktop",
        computerId: "demo-computer-1",
        lastAccessedAt: ago(9),
        action: "located",
        status: "permission-required",
        source: "demo",
        sessionId: "demo-session-2",
      },
      {
        id: "demo-file-4",
        name: "Offsite_Photos.zip",
        kind: "other",
        location: "Downloads",
        computerId: "demo-computer-1",
        lastAccessedAt: ago(60 * 26),
        action: "delivered",
        status: "delivered",
        source: "demo",
        sessionId: "demo-session-3",
      },
    ],
    live: {
      "demo-session-1": {
        connectionStatus: "connected",
        frame: null,
        selectedCandidateId: "demo-candidate-1",
        messages: [
          {
            id: "demo-msg-1",
            who: "You",
            side: "user",
            text: "Find the latest quarterly report — the final version, not a draft.",
            at: ago(3),
          },
          {
            id: "demo-msg-2",
            who: "Kylian",
            side: "agent",
            text: "I found two likely files. I’m opening both to compare which is the final version.",
            at: ago(2),
          },
          {
            id: "demo-msg-3",
            who: "Kylian",
            side: "agent",
            text: "Quarterly_Report_Q2.pdf looks like the final one. Want me to send it?",
            at: ago(1),
          },
        ],
        activity: [
          { id: "demo-act-1", label: "Received request", at: ago(4), state: "done" },
          { id: "demo-act-2", label: "Authenticated caller", at: ago(4), state: "done" },
          { id: "demo-act-3", label: "Searched allowed folders", at: ago(3), state: "done" },
          { id: "demo-act-4", label: "Opened two candidate files", at: ago(2), state: "done" },
          { id: "demo-act-5", label: "Comparing versions", at: ago(1), state: "current" },
          { id: "demo-act-6", label: "Waiting for approval", at: ago(0), state: "pending" },
        ],
        candidates: [
          {
            id: "demo-candidate-1",
            name: "Quarterly_Report_Q2.pdf",
            meta: "PDF · Modified today · 412 KB",
            ext: "PDF",
            evidence: "Marked “final” in the footer — matches the request.",
          },
          {
            id: "demo-candidate-2",
            name: "Quarterly_Report_Q2_draft.pdf",
            meta: "PDF · Modified last week · 398 KB",
            ext: "PDF",
            evidence: "Earlier draft version.",
          },
        ],
        approval: {
          id: "demo-approval-1",
          summary: "Kylian is ready to send a file to your verified device.",
          fileName: "Quarterly_Report_Q2.pdf",
          status: "pending",
        },
        feed: {
          task: "Find the latest quarterly report",
          currentApp: "Finder",
          action: "Comparing two candidate files",
          permission: "Ask every time",
        },
      },
    },
  };
}
