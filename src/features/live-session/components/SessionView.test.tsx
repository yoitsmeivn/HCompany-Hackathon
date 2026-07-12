import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SessionView from "@/features/live-session/components/SessionView";
import { emptyLiveSession } from "@/store/initialState";
import { makeSession, seedState, TestStoreProvider } from "@/test/testStore";

function renderSessionView() {
  const session = makeSession("s1", { name: "Call from +1 555 0123" });
  return render(
    <TestStoreProvider seed={seedState([session])}>
      <MemoryRouter>
        <SessionView session={session} computerName="Ivan's MacBook" live={emptyLiveSession()} />
      </MemoryRouter>
    </TestStoreProvider>,
  );
}

describe("SessionView top bar", () => {
  it("no longer renders the Pause / Take control / Mute voice / Stop controls", () => {
    renderSessionView();

    expect(screen.queryByText("Pause")).toBeNull();
    expect(screen.queryByText("Take control")).toBeNull();
    expect(screen.queryByText("Mute voice")).toBeNull();
    expect(screen.queryByText("Stop")).toBeNull();
  });

  it("renders a transcript-only sidebar without input, activity, candidates, or approval sections", () => {
    renderSessionView();

    expect(screen.getByText("Transcript")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Add an instruction…")).toBeNull();
    expect(screen.queryByText("Send")).toBeNull();
    expect(screen.queryByText("Agent activity")).toBeNull();
    expect(screen.queryByText(/candidate/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
  });

  it("keeps the back button, call identity, and connection state", () => {
    renderSessionView();

    expect(screen.getByRole("link", { name: "←" })).toBeTruthy();
    expect(screen.getByText("Call from +1 555 0123")).toBeTruthy();
    // emptyLiveSession starts in "connecting".
    expect(screen.getByText("CONNECTING")).toBeTruthy();
    expect(screen.getByText(/Ivan's MacBook/)).toBeTruthy();
  });
});
