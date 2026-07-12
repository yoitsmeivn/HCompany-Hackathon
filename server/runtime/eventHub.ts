import { randomUUID } from "node:crypto";
import type { MonitorEvent, MonitorEventEnvelope, RuntimeEvent, RuntimeEventEnvelope } from "../../shared/runtimeEvents.js";

type Listener = (envelope: RuntimeEventEnvelope) => void;
type MonitorListener = (envelope: MonitorEventEnvelope) => void;

export class RuntimeEventHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly recent = new Map<string, RuntimeEventEnvelope[]>();
  private readonly monitorListeners = new Set<MonitorListener>();
  private monitorRecent: MonitorEventEnvelope[] = [];

  emit(event: RuntimeEvent): RuntimeEventEnvelope {
    const envelope = { id: randomUUID(), at: new Date().toISOString(), event };
    const key = "sessionId" in event ? event.sessionId : "*";
    const history = [...(this.recent.get(key) ?? []), envelope].slice(-100);
    this.recent.set(key, history);
    for (const listener of this.listeners.get(key) ?? []) listener(envelope);
    return envelope;
  }

  emitMonitor(event: MonitorEvent): MonitorEventEnvelope {
    const envelope = { id: randomUUID(), at: new Date().toISOString(), event };
    this.monitorRecent = [...this.monitorRecent, envelope].slice(-50);
    for (const listener of this.monitorListeners) listener(envelope);
    return envelope;
  }

  subscribeMonitor(listener: MonitorListener, replay = true): () => void {
    this.monitorListeners.add(listener);
    if (replay) for (const envelope of this.monitorRecent) listener(envelope);
    return () => { this.monitorListeners.delete(listener); };
  }

  subscribe(sessionId: string, listener: Listener, replay = true, afterId?: string): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(sessionId, listeners);
    if (replay) {
      const history = this.recent.get(sessionId) ?? [];
      // Unknown/evicted afterId → findIndex -1 → start 0 → full bounded replay.
      const start = afterId ? history.findIndex((envelope) => envelope.id === afterId) + 1 : 0;
      for (const envelope of history.slice(start)) listener(envelope);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(sessionId);
    };
  }
}
