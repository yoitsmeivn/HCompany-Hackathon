// Demo controls are hidden unless explicitly enabled — either at build time
// via VITE_ENABLE_DEMO_CONTROLS=true or at runtime with ?demoControls=1.
// The query flag is captured once at app startup so client-side navigation
// (which rewrites the URL) doesn't toggle the panel mid-session.
const enabledAtStartup =
  import.meta.env.VITE_ENABLE_DEMO_CONTROLS === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demoControls") === "1");

export function demoControlsEnabled(): boolean {
  return enabledAtStartup;
}
