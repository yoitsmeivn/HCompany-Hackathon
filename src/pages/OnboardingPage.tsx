import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import KylianLogo from "@/components/brand/KylianLogo";
import AccessModePicker from "@/features/access/components/AccessModePicker";
import SelectionChips from "@/features/access/components/SelectionChips";
import type { AccessMode, AccessPolicy } from "@/features/access/types";
import { DEFAULT_ACCESS_POLICY } from "@/features/access/types";
import { useAppDispatch, useAppState } from "@/store/context";
import { activeComputerChanged, computerConnected, preferencesChanged } from "@/store/actions";
import { getServerConfig, saveOwnerPolicy } from "@/services/monitorService";

const FOLDER_OPTIONS = ["Desktop", "Documents", "Downloads", "Pictures"];
const APP_OPTIONS = ["Finder", "Preview", "Safari", "Chrome", "Mail"];

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 } as const;
const inputStyle = {
  width: "100%",
  border: "1px solid #e7e3dd",
  borderRadius: 7,
  background: "#fff",
  padding: "10px 12px",
  fontSize: 13.5,
  color: "#1c1b19",
  fontFamily: "inherit",
} as const;

export default function OnboardingPage() {
  usePageTitle("Set up Kylian");
  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [name, setName] = useState(state.preferences.name);
  const [authorizedPhone, setAuthorizedPhone] = useState(state.preferences.authorizedPhone);
  const [mode, setMode] = useState<AccessMode>(DEFAULT_ACCESS_POLICY.mode);
  const [folders, setFolders] = useState<string[]>(DEFAULT_ACCESS_POLICY.selectedFolders);
  const [applications, setApplications] = useState<string[]>(DEFAULT_ACCESS_POLICY.selectedApplications);
  const [smsConsent, setSmsConsent] = useState(state.preferences.smsConsent);
  const [computerId, setComputerId] = useState<string>("demo-computer");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getServerConfig()
      .then((config) => { if (!cancelled) { setComputerId(config.voiceComputerId ?? "demo-computer"); setPhoneNumber(config.twilioPhoneNumber); } })
      .catch(() => { /* keep defaults; the backend may be offline during setup */ });
    return () => { cancelled = true; };
  }, []);

  const toggle = (list: string[], set: (next: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const canStart = name.trim().length > 0 && !saving;

  const start = async () => {
    if (!canStart) return;
    setSaving(true);
    setError(null);
    const access: AccessPolicy = {
      ...DEFAULT_ACCESS_POLICY,
      mode,
      selectedFolders: mode === "selected" ? folders : DEFAULT_ACCESS_POLICY.selectedFolders,
      selectedApplications: mode === "selected" ? applications : DEFAULT_ACCESS_POLICY.selectedApplications,
    };
    try {
      await saveOwnerPolicy(computerId, {
        ownerName: name.trim(),
        authorizedPhone: authorizedPhone.trim(),
        allowedFolders: access.selectedFolders,
        allowedApplications: access.selectedApplications,
      });
    } catch {
      // The policy is still kept locally; monitoring can proceed offline.
    }
    dispatch(computerConnected({
      id: computerId,
      name: "This computer",
      status: "configured",
      lastSeenAt: null,
      access,
    }));
    dispatch(activeComputerChanged(computerId));
    dispatch(preferencesChanged({ name: name.trim(), authorizedPhone: authorizedPhone.trim(), configured: true, smsConsent }));
    setSaving(false);
    navigate("/monitor");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#faf9f7", display: "flex", justifyContent: "center", padding: "48px 20px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <KylianLogo size={30} />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Set up Kylian</span>
        </div>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "#6a665f", lineHeight: 1.55 }}>
          Tell Kylian who you are and what it may touch on this computer. Then it waits for your call
          {phoneNumber ? <> at <strong style={{ color: "#1c1b19" }}>{phoneNumber}</strong></> : null} and takes over from there.
        </p>

        <section style={{ border: "1px solid #e7e3dd", borderRadius: 10, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", padding: 22, display: "grid", gap: 20 }}>
          <div>
            <label style={labelStyle} htmlFor="owner-name">Your name</label>
            <input id="owner-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anthony Lamas" />
          </div>

          <div>
            <label style={labelStyle} htmlFor="owner-phone">Authorized phone</label>
            <input id="owner-phone" style={inputStyle} value={authorizedPhone} onChange={(e) => setAuthorizedPhone(e.target.value)} placeholder="+1 650 555 0000" inputMode="tel" />
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a958c", lineHeight: 1.45 }}>
              Only calls from this number trigger Kylian. Leave blank to accept any caller.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Computer access</label>
            <AccessModePicker value={mode} onChange={setMode} />
          </div>

          {mode === "selected" && (
            <>
              <div>
                <label style={labelStyle}>Allowed folders</label>
                <SelectionChips options={FOLDER_OPTIONS} selected={folders} onToggle={(v) => toggle(folders, setFolders, v)} addLabel="+ Add folder" />
              </div>
              <div>
                <label style={labelStyle}>Allowed applications</label>
                <SelectionChips options={APP_OPTIONS} selected={applications} onToggle={(v) => toggle(applications, setApplications, v)} addLabel="+ Add application" />
              </div>
            </>
          )}

          <div style={{ border: "1px solid #e7e3dd", borderRadius: 8, background: "#faf9f7", padding: "12px 14px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                style={{ marginTop: 2, width: 14, height: 14, flexShrink: 0, accentColor: "#1c1b19", cursor: "pointer" }}
              />
              <span style={{ fontSize: 12.5, color: "#3a382f", lineHeight: 1.6 }}>
                I agree to receive conversational and task-related SMS messages from Kylian. Message
                frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for
                assistance.
              </span>
            </label>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#9a958c" }}>
              Optional — not required to use Kylian. See our{" "}
              <Link to="/privacy" style={{ color: "#6a665f", textDecoration: "underline" }}>Privacy Policy</Link>{" "}
              and{" "}
              <Link to="/terms" style={{ color: "#6a665f", textDecoration: "underline" }}>Terms and Conditions</Link>.
            </p>
          </div>

          {error && <p style={{ margin: 0, fontSize: 12, color: "var(--k-danger)" }}>{error}</p>}

          <button
            className="k-primary"
            onClick={() => void start()}
            disabled={!canStart}
            style={{
              width: "100%", border: "none", borderRadius: 8, background: "#1c1b19", color: "#fff",
              padding: 12, fontSize: 14, fontWeight: 500, cursor: canStart ? "pointer" : "default",
              opacity: canStart ? 1 : 0.45, fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            {saving ? "Starting…" : "Start monitoring"}
          </button>
        </section>
      </div>
    </main>
  );
}
