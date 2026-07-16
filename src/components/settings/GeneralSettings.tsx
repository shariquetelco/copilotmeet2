import { useSettingsStore } from "@/store/settingsStore";

const themes = ["light", "dark", "system"];
const fontSizes = ["small", "medium", "large"];
const answerStyles = [
  "Professional",
  "Executive",
  "Consultant",
  "Friendly",
  "Technical",
  "Concise",
];

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-200">
      <span className="text-sm text-neutral-700">{label}</span>
      {children}
    </div>
  );
}

export default function GeneralSettings() {
  const { getSetting, updateSetting } = useSettingsStore();

  return (
    <div className="max-w-xl">
      <SettingRow label="Theme">
        <select
          value={getSetting("general.theme", "system")}
          onChange={(e) => updateSetting("general.theme", e.target.value)}
          className="border rounded px-2 py-1 text-sm capitalize"
        >
          {themes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Font Size">
        <select
          value={getSetting("general.font_size", "medium")}
          onChange={(e) => updateSetting("general.font_size", e.target.value)}
          className="border rounded px-2 py-1 text-sm capitalize"
        >
          {fontSizes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Language">
        <input
          value={getSetting("general.language", "English")}
          onChange={(e) => updateSetting("general.language", e.target.value)}
          className="border rounded px-2 py-1 text-sm w-32"
        />
      </SettingRow>

      <SettingRow label="Answer Style">
        <select
          value={getSetting("general.answer_style", "Professional")}
          onChange={(e) => updateSetting("general.answer_style", e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          {answerStyles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </SettingRow>

      <h2 className="text-sm font-semibold text-neutral-500 uppercase mt-6 mb-2">
        License
      </h2>

      <SettingRow label="License Key">
        <input
          placeholder="Enter license key"
          disabled
          className="border rounded px-2 py-1 text-sm w-48 bg-neutral-100 text-neutral-400"
        />
      </SettingRow>

      <SettingRow label="Status">
        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
          Trial (not yet implemented)
        </span>
      </SettingRow>

      <SettingRow label="Device ID">
        <span className="text-xs text-neutral-400 font-mono">not yet generated</span>
      </SettingRow>

      <button
        disabled
        className="mt-4 px-4 py-2 bg-neutral-300 text-neutral-500 rounded text-sm cursor-not-allowed"
      >
        Activate License (coming soon)
      </button>
    </div>
  );
}