import { randomUUID } from "node:crypto";
import type { RuntimeEvent, RuntimeEventEnvelope } from "../../shared/runtimeEvents.js";

type Listener = (envelope: RuntimeEventEnvelope) => void;

export class RuntimeEventHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly recent = new Map<string, RuntimeEventEnvelope[]>();

  emit(event: RuntimeEvent): RuntimeEventEnvelope {
    const envelope = { id: randomUUID(), at: new Date().toISOString(), event };
    const key = "sessionId" in event ? event.sessionId : "*";
    const history = [...(this.recent.get(key) ?? []), envelope].slice(-100);
    this.recent.set(key, history);
    for (const listener of this.listeners.get(key) ?? []) listener(envelope);
    return envelope;
  }

  subscribe(sessionId: string, listener: Listener, replay = true): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(sessionId, listeners);
    if (replay) for (const envelope of this.recent.get(sessionId) ?? []) listener(envelope);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(sessionId);
    };
  }
}
