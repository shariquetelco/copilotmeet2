import { useSettingsStore } from "@/store/settingsStore";

const themes = ["light", "dark", "system"];
const fontSizes = ["small", "medium", "large"];
const languages = [
  "English",
  "Mandarin Chinese",
  "Hindi",
  "Spanish",
  "French",
  "Arabic",
  "Bengali",
  "Portuguese",
  "German",
  "Japanese",
];

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
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <span className="text-[17px] font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-6 mb-6">
      <h2 className="text-[22px] font-bold text-foreground mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export default function GeneralSettings() {
  const { getSetting, updateSetting } = useSettingsStore();

  return (
    <div className="max-w-2xl">
      <SectionCard title="Preferences">
        <SettingRow label="Theme">
          <select
            value={getSetting("general.theme", "system")}
            onChange={(e) => updateSetting("general.theme", e.target.value)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] capitalize bg-white"
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
            className="border border-input rounded-lg px-3 py-2 text-[16px] capitalize bg-white"
          >
            {fontSizes.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Language">
          <select
            value={getSetting("general.language", "English")}
            onChange={(e) => updateSetting("general.language", e.target.value)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] bg-white"
          >
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Answer Style">
          <select
            value={getSetting("general.answer_style", "Professional")}
            onChange={(e) => updateSetting("general.answer_style", e.target.value)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] bg-white"
          >
            {answerStyles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingRow>
      </SectionCard>

      <SectionCard title="License">
        <SettingRow label="License Key">
          <input
            placeholder="Enter license key"
            disabled
            className="border border-input rounded-lg px-3 py-2 text-[16px] w-48 bg-muted text-muted-foreground"
          />
        </SettingRow>

        <SettingRow label="Status">
          <span className="text-[14px] font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">
            Trial (not yet implemented)
          </span>
        </SettingRow>

        <SettingRow label="Device ID">
          <span className="text-[14px] text-muted-foreground font-mono">not yet generated</span>
        </SettingRow>

        <button
          disabled
          className="mt-4 px-5 py-3 bg-muted text-muted-foreground rounded-xl text-[16px] font-semibold cursor-not-allowed"
        >
          Activate License (coming soon)
        </button>
      </SectionCard>
    </div>
  );
}