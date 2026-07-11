import { NavLink } from "react-router-dom";
import { Folder, LayoutList, Monitor } from "lucide-react";
import KylianWordmark from "@/components/brand/KylianWordmark";

const NAV_ITEMS = [
  { icon: LayoutList, label: "Sessions", to: "/dashboard" },
  { icon: Monitor, label: "Computers", to: "/computers" },
  { icon: Folder, label: "Files", to: "/files" },
];

export default function DashboardSidebar() {
  return (
    <aside
      className="k-sidebar"
      style={{
        borderRight: "1px solid #e7e3dd",
        background: "#faf9f7",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div style={{ padding: "0 6px" }}>
        <KylianWordmark />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) => (isActive ? "k-navitem k-navitem-active" : "k-navitem")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 6,
              fontSize: 13.5,
              fontWeight: 450,
              color: "#6a665f",
            }}
          >
            <item.icon size={15} strokeWidth={1.75} style={{ opacity: 0.8, flex: "none" }} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
