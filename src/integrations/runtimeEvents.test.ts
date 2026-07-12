import { describe, expect, it, vi } from "vitest";
import { applyRuntimeEvent, type RuntimeEventEnvelope } from "@/integrations/runtimeEvents";

const AT = "2026-07-12T10:00:00.000Z";

describe("applyRuntimeEvent", () => {
  it("derives the same message id from the same envelope every time", () => {
    const envelope: RuntimeEventEnvelope = {
      id: "abc-123",
      at: AT,
      event: { kind: "user-message", sessionId: "s1", text: "What can you do?", who: "Caller" },
    };
    const dispatch = vi.fn();

    applyRuntimeEvent(dispatch, envelope);
    applyRuntimeEvent(dispatch, envelope);

    expect(dispatch).toHaveBeenCalledTimes(2);
    const [first, second] = dispatch.mock.calls.map(([action]) => action);
    expect(first).toEqual(second);
    expect(first).toEqual({
      type: "SESSION_MESSAGE_ADDED",
      sessionId: "s1",
      message: { id: "msg-abc-123", who: "Caller", side: "user", text: "What can you do?", at: AT },
    });
  });

  it("maps agent-message to a Kylian bubble with an envelope-derived id", () => {
    const dispatch = vi.fn();
    applyRuntimeEvent(dispatch, {
      id: "def-456",
      at: AT,
      event: { kind: "agent-message", sessionId: "s1", text: "I can find and send your files." },
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "SESSION_MESSAGE_ADDED",
      sessionId: "s1",
      message: {
        id: "msg-def-456",
        who: "Kylian",
        side: "agent",
        text: "I can find and send your files.",
        at: AT,
      },
    });
  });

  it("ignores agent-speech events (server-side TTS chunks, not transcript entries)", () => {
    const dispatch = vi.fn();
    applyRuntimeEvent(dispatch, {
      id: "ghi-789",
      at: AT,
      event: { kind: "agent-speech", sessionId: "s1", text: "I can find" },
    });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
