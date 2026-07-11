import { Outlet } from "react-router-dom";
import DashboardSidebar from "@/components/navigation/DashboardSidebar";
import DashboardHeader from "@/components/navigation/DashboardHeader";

export default function DashboardLayout() {
  return (
    <div
      className="k-dash-grid"
      style={{ display: "grid", gridTemplateColumns: "236px 1fr", minHeight: "100vh" }}
    >
      <DashboardSidebar />
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashboardHeader />
        <div style={{ padding: "32px 28px", maxWidth: 1120, width: "100%" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
