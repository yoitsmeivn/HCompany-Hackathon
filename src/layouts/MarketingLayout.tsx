import { Outlet } from "react-router-dom";
import MarketingHeader from "@/components/navigation/MarketingHeader";

export default function MarketingLayout() {
  return (
    <>
      <MarketingHeader />
      <Outlet />
    </>
  );
}
