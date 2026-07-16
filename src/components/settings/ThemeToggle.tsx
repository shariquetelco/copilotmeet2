import { useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";

const themes = ["light", "dark", "system"] as const;

export default function ThemeToggle() {
  const { fetchSettings, getSetting, updateSetting } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, []);

  const currentTheme = getSetting("general.theme", "system");

  return (
    <div className="flex gap-2">
      {themes.map((theme) => (
        <button
          key={theme}
          onClick={() => updateSetting("general.theme", theme)}
          className={`px-3 py-1 rounded text-sm capitalize ${
            currentTheme === theme
              ? "bg-neutral-900 text-white"
              : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {theme}
        </button>
      ))}
    </div>
  );
}