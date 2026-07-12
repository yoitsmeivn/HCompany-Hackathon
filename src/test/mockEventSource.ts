import type { RuntimeEventEnvelope } from "../../shared/runtimeEvents";

// jsdom has no EventSource; tests install this via vi.stubGlobal("EventSource", ...).
export class MockEventSource {
  static instances: MockEventSource[] = [];

  static reset(): void {
    MockEventSource.instances = [];
  }

  static open(): MockEventSource[] {
    return MockEventSource.instances.filter((source) => !source.closed);
  }

  onmessage: ((message: { data: string }) => void) | null = null;
  closed = false;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emit(envelope: RuntimeEventEnvelope): void {
    // A CLOSED EventSource dispatches nothing.
    if (this.closed) return;
    this.onmessage?.({ data: JSON.stringify(envelope) });
  }
}
