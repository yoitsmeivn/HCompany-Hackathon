import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEvent, RuntimeEventEnvelope } from "@/integrations/runtimeEvents";
import type { Session } from "@/features/sessions/types";
import SessionPage from "@/pages/SessionPage";
import { MockEventSource } from "@/test/mockEventSource";
import { makeSession, seedState, TestStoreProvider } from "@/test/testStore";

let envelopeCounter = 0;
function envelope(event: RuntimeEvent, id = `env-${++envelopeCounter}`): RuntimeEventEnvelope {
  return { id, at: "2026-07-12T10:00:01.000Z", event };
}

function callerSays(text: string, id?: string): RuntimeEventEnvelope {
  return envelope({ kind: "user-message", sessionId: "s1", text, who: "Caller" }, id);
}

function kylianSays(text: string, id?: string): RuntimeEventEnvelope {
  return envelope({ kind: "agent-message", sessionId: "s1", text }, id);
}

function renderSessionPage({
  sessions = [makeSession("s1")],
  strict = false,
}: { sessions?: Session[]; strict?: boolean } = {}) {
  const router = createMemoryRouter([{ path: "/session/:sessionId", element: <SessionPage /> }], {
    initialEntries: [`/session/${sessions[0].id}`],
  });
  const ui = (
    <TestStoreProvider seed={seedState(sessions)}>
      <RouterProvider router={router} />
    </TestStoreProvider>
  );
  const utils = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { ...utils, router };
}

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SessionPage event deduplication", () => {
  it("renders a message once when the same SSE envelope is delivered twice", () => {
    renderSessionPage();
    const source = MockEventSource.open()[0];
    const utterance = callerSays("What can you do?");

    act(() => {
      source.emit(utterance);
      source.emit(utterance);
    });

    expect(screen.getAllByText("What can you do?")).toHaveLength(1);
  });

  it("renders a message once when it arrives first via replay and later live", () => {
    renderSessionPage();
    const source = MockEventSource.open()[0];
    const reply = kylianSays("I can find and send your files.");

    // Server replay burst on connect…
    act(() => source.emit(reply));
    // …then the hub emits the same envelope live.
    act(() => source.emit(reply));

    expect(screen.getAllByText("I can find and send your files.")).toHaveLength(1);
  });

  it("renders exactly one bubble per finalized caller and Kylian event, and none for agent-speech", () => {
    renderSessionPage();
    const source = MockEventSource.open()[0];

    act(() => {
      source.emit(callerSays("Send me the quarterly report"));
      source.emit(envelope({ kind: "agent-speech", sessionId: "s1", text: "On it —" }));
      source.emit(kylianSays("On it — locating the report now."));
    });

    expect(screen.getAllByText("Send me the quarterly report")).toHaveLength(1);
    expect(screen.getAllByText("On it — locating the report now.")).toHaveLength(1);
    expect(screen.getAllByText("Caller")).toHaveLength(1);
    expect(screen.getAllByText("Kylian")).toHaveLength(1);
    expect(screen.queryByText("On it —")).toBeNull();
  });
});

describe("SessionPage subscription lifecycle", () => {
  it("keeps a single open EventSource under StrictMode double-mounting", () => {
    renderSessionPage({ strict: true });

    // StrictMode mounts, cleans up, and remounts the effect: two constructions,
    // but only the second connection stays open.
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.open()).toHaveLength(1);

    const source = MockEventSource.open()[0];
    const utterance = callerSays("What can you do?");
    act(() => {
      source.emit(utterance);
      source.emit(utterance);
    });
    expect(screen.getAllByText("What can you do?")).toHaveLength(1);
  });

  it("closes the previous subscription and opens a new one when the session changes", async () => {
    const { router } = renderSessionPage({ sessions: [makeSession("s1"), makeSession("s2")] });
    const first = MockEventSource.open()[0];
    expect(first.url).toContain("s1");

    await act(async () => {
      await router.navigate("/session/s2");
    });

    expect(first.closed).toBe(true);
    const open = MockEventSource.open();
    expect(open).toHaveLength(1);
    expect(open[0].url).toContain("s2");
  });

  it("cleans up the subscription on unmount", () => {
    const { unmount } = renderSessionPage();
    expect(MockEventSource.open()).toHaveLength(1);
    unmount();
    expect(MockEventSource.open()).toHaveLength(0);
  });
});
