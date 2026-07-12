import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import AccessSummaryLine from "@/features/access/components/AccessSummaryLine";
import { nowIso } from "@/lib/time";
import { useAppDispatch, useAppState } from "@/store/context";
import { liveConnectionChanged, liveSessionInitialized, sessionCreated, sessionUpdated } from "@/store/actions";
import { selectActiveComputer } from "@/store/selectors";
import { getServerConfig, simulateCall, subscribeToMonitor } from "@/services/monitorService";

export default function MonitoringPage() {
  usePageTitle("Monitoring");
  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const computer = selectActiveComputer(state);

  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [voiceConfigured, setVoiceConfigured] = useState(true);

  // Ignore the replay burst the monitor stream sends on connect so we don't
  // jump into a call that already ended; only act on genuinely new calls.
  const armed = useRef(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    getServerConfig()
      .then((config) => { if (!cancelled) { setPhoneNumber(config.twilioPhoneNumber); setVoiceConfigured(config.voiceConfigured); } })
      .catch(() => { if (!cancelled) setVoiceConfigured(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const armTimer = setTimeout(() => { armed.current = true; }, 400);
    const unsubscribe = subscribeToMonitor(({ event }) => {
      if (event.kind === "call-ended") {
        dispatch(sessionUpdated(event.sessionId, { state: "complete", status: "Ended" }));
        dispatch(liveConnectionChanged(event.sessionId, "disconnected"));
        return;
      }
      if (event.kind !== "call-started" || !armed.current || handled.current.has(event.sessionId)) return;
      handled.current.add(event.sessionId);
      dispatch(sessionCreated({
        id: event.sessionId,
        name: event.from ? `Call from ${event.from}` : "Incoming call",
        detail: "Live phone call",
        lastActiveAt: nowIso(),
        computerId: event.computerId,
        status: "Active",
        state: "active",
        accessMode: computer?.access.mode ?? "ask",
      }));
      dispatch(liveSessionInitialized(event.sessionId));
      dispatch(liveConnectionChanged(event.sessionId, "connected"));
      navigate(`/session/${event.sessionId}`);
    });
    return () => { clearTimeout(armTimer); unsubscribe(); };
  }, [dispatch, navigate, computer?.access.mode]);

  if (!state.loading.sessions && !state.preferences.configured) return <Navigate to="/onboarding" replace />;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 0, padding: "48px 20px", textAlign: "center" }}>
      <span className="k-pulse" style={{ height: 12, width: 12, borderRadius: "50%", background: voiceConfigured ? "#1c1b19" : "#a33a2e", marginBottom: 20 }} />
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em" }}>
        {voiceConfigured ? "Monitoring for a call" : "Voice transport not configured"}
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6a665f", maxWidth: 420, lineHeight: 1.6 }}>
        {voiceConfigured ? (
          <>Kylian is idle and listening. Call{phoneNumber ? <> <strong style={{ color: "#1c1b19" }}>{phoneNumber}</strong></> : " your Kylian number"} and it takes over this computer automatically.</>
        ) : (
          <>Set <code>TWILIO_PHONE_NUMBER</code> and <code>TWILIO_MEDIA_STREAM_URL</code> on the backend to receive calls. You can still review past sessions.</>
        )}
      </p>

      <div style={{ marginTop: 28, width: "100%", maxWidth: 420, display: "grid", gap: 12, textAlign: "left" }}>
        <InfoRow label="Owner" value={state.preferences.name || "—"} />
        <InfoRow label="Authorized caller" value={state.preferences.authorizedPhone || "Any caller"} />
        <div style={{ border: "1px solid #e7e3dd", borderRadius: 8, background: "#fff", padding: "12px 14px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9a958c" }}>Computer access</p>
          {computer ? <AccessSummaryLine access={computer.access} /> : <p style={{ margin: 0, fontSize: 12, color: "#9a958c" }}>No computer configured.</p>}
        </div>
      </div>

      {import.meta.env.DEV && (
        <button
          onClick={() => void simulateCall({ from: state.preferences.authorizedPhone || undefined }).catch(() => {})}
          style={{ marginTop: 24, border: "1px dashed #cfcabf", background: "#fff", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 500, color: "#6a665f", cursor: "pointer", fontFamily: "inherit" }}
        >
          Simulate an incoming call (dev)
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #e7e3dd", borderRadius: 8, background: "#fff", padding: "12px 14px" }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9a958c" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1c1b19", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
