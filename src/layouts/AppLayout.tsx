import { NavLink, Outlet } from "react-router-dom";
import KylianLogo from "@/components/brand/KylianLogo";
import { useAppState } from "@/store/context";

const tabStyle = (active: boolean) => ({
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 12px",
  borderRadius: 7,
  color: active ? "#1c1b19" : "#6a665f",
  background: active ? "#f5f2ed" : "transparent",
  border: `1px solid ${active ? "#e7e3dd" : "transparent"}`,
  transition: "all .12s",
});

export default function AppLayout() {
  const state = useAppState();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#faf9f7" }}>
      <header style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #e7e3dd", background: "#fff", padding: "0 18px", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <KylianLogo size={24} />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Kylian</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <NavLink to="/monitor" style={({ isActive }) => tabStyle(isActive)}>Monitor</NavLink>
            <NavLink to="/sessions" style={({ isActive }) => tabStyle(isActive)}>Sessions</NavLink>
          </nav>
        </div>
        {state.preferences.name && (
          <span style={{ fontSize: 12.5, color: "#6a665f" }}>{state.preferences.name}</span>
        )}
      </header>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </main>
    </div>
  );
}
