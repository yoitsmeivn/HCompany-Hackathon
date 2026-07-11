import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import Toggle from "@/components/ui/Toggle";
import SegmentedControl from "@/components/ui/SegmentedControl";
import AccessModePicker from "@/features/access/components/AccessModePicker";
import SelectionChips from "@/features/access/components/SelectionChips";
import type { AccessPolicy } from "@/features/access/types";
import { DEFAULT_ACCESS_POLICY } from "@/features/access/types";

const FOLDER_OPTIONS = ["Desktop", "Documents", "Downloads", "Projects"];
const APPLICATION_OPTIONS = ["Finder", "Preview", "Mail", "Notes"];
const CHANNELS = ["Phone", "WhatsApp", "Slack", "Web chat"];

const RECENT_SESSIONS = [
  { id: "pitch-deck", title: "Find latest pitch deck", time: "2m ago", status: "Complete" },
  { id: "demo-session", title: "Retrieve technical resume", time: "Active now", status: "Active" },
  { id: "signed-lease", title: "Send signed lease", time: "1m ago", status: "Waiting" },
];

function toggleItem(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
}

export default function SetupPage() {
  usePageTitle("Connect your computer");

  const [access, setAccess] = useState<AccessPolicy>(DEFAULT_ACCESS_POLICY);
  const [channel, setChannel] = useState("Phone");
  const [waiting, setWaiting] = useState(false);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "44px 28px 72px" }}>
      <div style={{ maxWidth: 560 }}>
        <h1
          className="k-demo-title"
          style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Connect your computer
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#6a665f" }}>
          Call or message Kylian when you need something from the computer you left behind.
        </p>
      </div>

      <div
        className="k-demo-grid"
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Setup card */}
        <section
          style={{
            border: "1px solid #e7e3dd",
            borderRadius: 10,
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: "1px solid #f0ece6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Setup</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 500,
                color: "#6a665f",
              }}
            >
              <span
                className="k-pulse"
                style={{ height: 6, width: 6, borderRadius: "50%", background: "#b3aea3" }}
              />
              Not connected
            </span>
          </div>

          <div style={{ padding: 22, display: "grid", gap: 20 }}>
            {/* Phone */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
                Phone number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid #e7e3dd",
                    borderRadius: 7,
                    background: "#faf9f7",
                    padding: "0 11px",
                    fontSize: 13.5,
                    color: "#3a382f",
                    whiteSpace: "nowrap",
                  }}
                >
                  🇺🇸 +1
                </span>
                <input
                  className="k-input"
                  defaultValue="(310) 555-0148"
                  style={{
                    flex: 1,
                    border: "1px solid #e7e3dd",
                    borderRadius: 7,
                    background: "#fff",
                    padding: "10px 12px",
                    fontSize: 13.5,
                    color: "#1c1b19",
                    fontFamily: "inherit",
                    transition: "border-color .12s, box-shadow .12s",
                  }}
                />
              </div>
              <p style={{ margin: "7px 0 0", fontSize: 11.5, color: "#9a958c" }}>
                Kylian will only accept calls and messages from this verified number.
              </p>
            </div>

            {/* Computer name */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
                Computer name
              </label>
              <input
                className="k-input"
                defaultValue="Ivan’s MacBook Pro"
                style={{
                  width: "100%",
                  border: "1px solid #e7e3dd",
                  borderRadius: 7,
                  background: "#fff",
                  padding: "10px 12px",
                  fontSize: 13.5,
                  color: "#1c1b19",
                  fontFamily: "inherit",
                  transition: "border-color .12s, box-shadow .12s",
                }}
              />
            </div>

            {/* Computer access */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
                Computer access
              </label>
              <AccessModePicker
                value={access.mode}
                onChange={(mode) => setAccess((p) => ({ ...p, mode }))}
              />
            </div>

            {access.mode === "selected" && (
              <>
                <div>
                  <label
                    style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}
                  >
                    Allowed folders
                  </label>
                  <SelectionChips
                    options={FOLDER_OPTIONS}
                    selected={access.selectedFolders}
                    onToggle={(name) =>
                      setAccess((p) => ({
                        ...p,
                        selectedFolders: toggleItem(p.selectedFolders, name),
                      }))
                    }
                    addLabel="+ Add folder"
                  />
                  <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "#9a958c" }}>
                    Kylian can only read or open files inside these folders.
                  </p>
                </div>

                <div>
                  <label
                    style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}
                  >
                    Allowed applications
                  </label>
                  <SelectionChips
                    options={APPLICATION_OPTIONS}
                    selected={access.selectedApplications}
                    onToggle={(name) =>
                      setAccess((p) => ({
                        ...p,
                        selectedApplications: toggleItem(p.selectedApplications, name),
                      }))
                    }
                    addLabel="+ Add application"
                  />
                  <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "#9a958c" }}>
                    Kylian can only operate these applications on your behalf.
                  </p>
                </div>
              </>
            )}

            {/* Channel */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
                Preferred messaging channel
              </label>
              <SegmentedControl options={CHANNELS} value={channel} onChange={setChannel} />
            </div>

            {/* Toggles */}
            <div style={{ display: "grid", gap: 12 }}>
              {[
                {
                  title: "Voice enabled",
                  caption: "Speak to Kylian and hear spoken replies.",
                  on: access.voiceEnabled,
                  toggle: () => setAccess((p) => ({ ...p, voiceEnabled: !p.voiceEnabled })),
                },
                {
                  title: "Live view enabled",
                  caption: "Watch the screen and steer during a session.",
                  on: access.liveViewEnabled,
                  toggle: () => setAccess((p) => ({ ...p, liveViewEnabled: !p.liveViewEnabled })),
                },
                {
                  title: "Ask before sending files",
                  caption: "Kylian waits for your approval before a file leaves this computer.",
                  on: !access.allowFileDelivery,
                  toggle: () =>
                    setAccess((p) => ({ ...p, allowFileDelivery: !p.allowFileDelivery })),
                },
              ].map((row) => (
                <div
                  key={row.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    border: "1px solid #e7e3dd",
                    borderRadius: 8,
                    background: "#faf9f7",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{row.title}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#9a958c" }}>
                      {row.caption}
                    </p>
                  </div>
                  <Toggle on={row.on} onToggle={row.toggle} label={row.title} />
                </div>
              ))}
            </div>

            {/* Action */}
            <div style={{ display: "grid", gap: 12 }}>
              <button
                className="k-primary"
                onClick={() => setWaiting((w) => !w)}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 8,
                  background: "#1c1b19",
                  color: "#fff",
                  padding: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background .15s",
                  fontFamily: "inherit",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                {waiting ? "Cancel connection" : "Connect this computer"}
              </button>
              {waiting && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid #e7e3dd",
                    borderRadius: 8,
                    background: "#f7f5f0",
                    padding: "12px 14px",
                  }}
                >
                  <span
                    className="k-pulse"
                    style={{ height: 8, width: 8, borderRadius: "50%", background: "#1c1b19" }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500 }}>Waiting for call</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#9a958c" }}>
                      Call or message Kylian from (310) 555-0148 to begin.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Aside */}
        <aside style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid #e7e3dd",
              borderRadius: 10,
              background: "#fff",
              padding: 18,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  display: "flex",
                  height: 30,
                  width: 30,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 7,
                  background: "#f5f2ed",
                  border: "1px solid #e7e3dd",
                  fontSize: 14,
                }}
              >
                ◱
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Local companion</span>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "#6a665f" }}>
              This demo connects only to the computer running the local Kylian companion. Nothing
              leaves your machine without approval.
            </p>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 7,
                borderTop: "1px solid #f0ece6",
                paddingTop: 12,
              }}
            >
              <span style={{ height: 7, width: 7, borderRadius: "50%", background: "#1c1b19" }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                Companion detected on this network
              </span>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e7e3dd",
              borderRadius: 10,
              background: "#fff",
              padding: 18,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "#9a958c",
              }}
            >
              Recent sessions
            </p>
            <div style={{ display: "grid", gap: 2 }}>
              {RECENT_SESSIONS.map((s) => (
                <Link
                  key={s.id}
                  to={`/session/${s.id}`}
                  className="k-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    borderRadius: 6,
                    padding: "9px 8px",
                    color: "inherit",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#9a958c" }}>{s.time}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "#9a958c", whiteSpace: "nowrap" }}>
                    {s.status}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              to="/dashboard"
              style={{
                marginTop: 8,
                display: "block",
                borderTop: "1px solid #f0ece6",
                paddingTop: 11,
                fontSize: 12,
                fontWeight: 500,
                color: "#3a382f",
              }}
            >
              View all sessions →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
