import { useEffect, useState } from "react";
import "./App.css";
import PetWidget from "@/components/pet/PetWidget";
import SettingsPage from "@/pages/SettingsPage";
import ActivationScreen from "@/components/license/ActivationScreen";
import LockedScreen from "@/components/license/LockedScreen";
import GettingStarted from "@/components/license/GettingStarted";
import { usePetStore } from "@/store/petStore";
import { settingsService } from "@/lib/settingsService";

type AppMode = { mode: string; [key: string]: unknown };

async function spawnPetWindow() {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel("pet");
  if (existing) return;

  new WebviewWindow("pet", {
    url: "index.html",
    title: "CopilotMeet",
    width: 100,
    height: 100,
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    shadow: false,
  });
}

function MainApp() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const status = await invoke<AppMode>("get_license_status");
      setMode(status);

      const seen = await settingsService.get("onboarding.ai_setup_seen");
      setOnboardingDone(seen === "true");
    })();
  }, []);

  useEffect(() => {
    if (mode && ["Licensed", "Trial", "Grace"].includes(mode.mode)) {
      spawnPetWindow();
    }
  }, [mode]);

  if (mode === null) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (mode.mode === "ActivationRequired") {
    return <ActivationScreen onResolved={setMode} />;
  }

  if (mode.mode === "Locked") {
    return <LockedScreen reason={String(mode.reason ?? "This license is no longer valid.")} />;
  }

  if (mode.mode === "Licensed" && onboardingDone === false) {
    return (
      <GettingStarted
        onComplete={() => {
          settingsService.set("onboarding.ai_setup_seen", "true");
          setOnboardingDone(true);
        }}
      />
    );
  }

  return (
    <>
      {mode.mode === "Grace" && (
        <div className="bg-orange-100 text-orange-700 text-sm text-center py-1.5">
          Offline mode – {String(mode.days_remaining)} days of grace remaining
        </div>
      )}
      <SettingsPage />
    </>
  );
}

function App() {
  const { hydrated, hydrate } = usePetStore();
  const [isPetWindow, setIsPetWindow] = useState<boolean | null>(null);

  useEffect(() => {
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
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

        const { resetPetWindowPosition } = await import("@/lib/petWindow");
        await resetPetWindowPosition();

        const { listen } = await import("@tauri-apps/api/event");
        listen("pet_settings_changed", () => {
          resetPetWindowPosition();
        });
      }
    });
    hydrate();
  }, []);

  if (isPetWindow === null) return null;

  if (isPetWindow) {
    return hydrated ? <PetWidget /> : null;
  }

  return <MainApp />;
}

export default App;