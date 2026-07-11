// Transport boundary for the future Node/Express backend.
//
// The services in this folder are local adapters today (they read the
// persisted snapshot, or return empty data). When the backend lands, replace
// their bodies with `fetch(`${API_BASE}/...`)` calls — the store provider and
// page components do not change. Real-time events (companion, Twilio/Gradium,
// H Company, WebRTC) enter through src/integrations/runtimeEvents.ts.
export function resolve<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}
