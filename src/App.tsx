import { useEffect, useState } from "react";
import "./App.css";
import PetWidget from "@/components/pet/PetWidget";
import SettingsPage from "@/pages/SettingsPage";
import { usePetStore } from "@/store/petStore";
import { settingsService } from "@/lib/settingsService";

function App() {
  const { hydrated, hydrate } = usePetStore();
  const [isPetWindow, setIsPetWindow] = useState<boolean | null>(null);

  useEffect(() => {
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow, currentMonitor }) => {
      const win = getCurrentWindow();
      const isPet = win.label === "pet";
      setIsPetWindow(isPet);

      if (isPet) {
        document.documentElement.style.background = "transparent";
        document.body.style.background = "transparent";
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.documentElement.style.margin = "0";
        document.body.style.margin = "0";

        const { LogicalPosition } = await import("@tauri-apps/api/dpi");
        const monitor = await currentMonitor();
        const dockPosition = (await settingsService.get("pet.position")) || "bottom-right";

        if (monitor) {
          const margin = 24;
          const scale = monitor.scaleFactor;
          const winSize = await win.outerSize();
          const monitorX = monitor.position.x / scale;
          const monitorY = monitor.position.y / scale;
          const monitorW = monitor.size.width / scale;
          const monitorH = monitor.size.height / scale;
          const w = winSize.width / scale;
          const h = winSize.height / scale;

          const corners: Record<string, { x: number; y: number }> = {
            "top-left": { x: monitorX + margin, y: monitorY + margin },
            "top-right": { x: monitorX + monitorW - w - margin, y: monitorY + margin },
            "bottom-left": { x: monitorX + margin, y: monitorY + monitorH - h - margin },
            "bottom-right": { x: monitorX + monitorW - w - margin, y: monitorY + monitorH - h - margin },
          };
          const target = corners[dockPosition] ?? corners["bottom-right"];
          await win.setPosition(new LogicalPosition(target.x, target.y));
        }
      }
    });
    hydrate();
  }, []);

  if (isPetWindow === null) return null;

  if (isPetWindow) {
    return hydrated ? <PetWidget /> : null;
  }

  return <SettingsPage />;
}

export default App;