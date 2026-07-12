import { describe, expect, it } from "vitest";
import type { Message } from "@/features/live-session/types";
import type { AppAction } from "@/store/actions";
import { initialState, type AppState } from "@/store/initialState";
import { reducer } from "@/store/reducer";

const SESSION_ID = "s1";

function apply(actions: AppAction[], from: AppState = initialState): AppState {
  return actions.reduce(reducer, from);
}

function message(id: string, text = "Hello"): Message {
  return { id, who: "Caller", side: "user", text, at: "2026-07-12T10:00:00.000Z" };
}

describe("reducer idempotency", () => {
  it("ignores a SESSION_MESSAGE_ADDED with an already-present message id", () => {
    const added = apply([
      { type: "LIVE_SESSION_INITIALIZED", sessionId: SESSION_ID },
      { type: "SESSION_MESSAGE_ADDED", sessionId: SESSION_ID, message: message("msg-1") },
    ]);
    const again = reducer(added, {
      type: "SESSION_MESSAGE_ADDED",
      sessionId: SESSION_ID,
      message: message("msg-1", "Different text, same id"),
    });

    expect(again).toBe(added);
    expect(again.live[SESSION_ID].messages).toHaveLength(1);
    expect(again.live[SESSION_ID].messages[0].text).toBe("Hello");
  });

  it("still appends messages with new ids", () => {
    const state = apply([
      { type: "LIVE_SESSION_INITIALIZED", sessionId: SESSION_ID },
      { type: "SESSION_MESSAGE_ADDED", sessionId: SESSION_ID, message: message("msg-1") },
      { type: "SESSION_MESSAGE_ADDED", sessionId: SESSION_ID, message: message("msg-2", "Second") },
    ]);
    expect(state.live[SESSION_ID].messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"]);
  });

  it("ignores a SESSION_EVENT_ADDED with an already-present event id", () => {
    const event = { id: "evt-1", label: "Opening Finder", at: "2026-07-12T10:00:00.000Z", state: "current" as const };
    const added = apply([
      { type: "LIVE_SESSION_INITIALIZED", sessionId: SESSION_ID },
      { type: "SESSION_EVENT_ADDED", sessionId: SESSION_ID, event },
    ]);
    const again = reducer(added, { type: "SESSION_EVENT_ADDED", sessionId: SESSION_ID, event });

    expect(again).toBe(added);
    expect(again.live[SESSION_ID].activity).toHaveLength(1);
    // A duplicate must not flip the current step to done.
    expect(again.live[SESSION_ID].activity[0].state).toBe("current");
  });

  it("ignores a CANDIDATE_FILE_ADDED with an already-present candidate id", () => {
    const candidate = { id: "cand-1", name: "Report.pdf", meta: "2 MB", ext: "pdf" };
    const added = apply([
      { type: "LIVE_SESSION_INITIALIZED", sessionId: SESSION_ID },
      { type: "CANDIDATE_FILE_ADDED", sessionId: SESSION_ID, candidate },
    ]);
    const again = reducer(added, { type: "CANDIDATE_FILE_ADDED", sessionId: SESSION_ID, candidate });

    expect(again).toBe(added);
    expect(again.live[SESSION_ID].candidates).toHaveLength(1);
  });

  it("does not reset a resolved approval when the same request is replayed", () => {
    const approval = { id: "appr-1", summary: "Send Report.pdf", fileName: "Report.pdf", status: "pending" as const };
    const resolved = apply([
      { type: "LIVE_SESSION_INITIALIZED", sessionId: SESSION_ID },
      { type: "APPROVAL_REQUESTED", sessionId: SESSION_ID, approval },
      { type: "APPROVAL_RESOLVED", sessionId: SESSION_ID, approved: true },
    ]);
    const again = reducer(resolved, { type: "APPROVAL_REQUESTED", sessionId: SESSION_ID, approval });

    expect(again).toBe(resolved);
    expect(again.live[SESSION_ID].approval?.status).toBe("approved");
  });
});
