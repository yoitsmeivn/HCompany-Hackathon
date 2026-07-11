import { RouterProvider } from "react-router-dom";
import { AppStoreProvider } from "@/store/AppStore";
import DemoControlsPanel from "@/features/demo/components/DemoControlsPanel";
import { router } from "./router";

export default function App() {
  return (
    <AppStoreProvider>
      <RouterProvider router={router} />
      <DemoControlsPanel />
    </AppStoreProvider>
  );
}
