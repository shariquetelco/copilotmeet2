import { useState, useEffect } from "react";
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

type LicenseDetails = {
  mode: string;
  plan: string | null;
  email: string | null;
  max_devices: number | null;
  activation_count: number | null;
  masked_key: string | null;
  last_verified_at: number | null;
  expires_at: number | null;
};

function timeAgo(unixSeconds: number | null): string {
  if (!unixSeconds) return "never";
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function daysRemaining(expUnixSeconds: number | null): number {
  if (!expUnixSeconds) return 0;
  return Math.max(0, Math.ceil((expUnixSeconds - Date.now() / 1000) / 86400));
}

function LicenseSection() {
  const [details, setDetails] = useState<LicenseDetails | null>(null);

  useEffect(() => {
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const d = await invoke<LicenseDetails>("get_license_details");
      setDetails(d);
    })();
  }, []);

  if (!details) {
    return (
      <SectionCard title="License">
        <p className="text-[14px] text-muted-foreground">Loading...</p>
      </SectionCard>
    );
  }

  if (details.mode === "ActivationRequired") {
    return (
      <SectionCard title="License">
        <p className="text-[14px] text-muted-foreground">No license activated.</p>
      </SectionCard>
    );
  }

  const isTrial = details.mode === "Trial";

  return (
    <SectionCard title="License">
      <SettingRow label="Status">
        <span
          className={`text-[14px] font-semibold px-3 py-1 rounded-full ${
            isTrial ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
          }`}
        >
          {isTrial ? "🟡 Trial" : "✅ Active"}
        </span>
      </SettingRow>

      <SettingRow label="Plan">
        <span className="text-[14px]">{details.plan ?? "—"}</span>
      </SettingRow>

      <SettingRow label="Email">
        <span className="text-[14px]">{details.email ?? "—"}</span>
      </SettingRow>

      {isTrial ? (
        <>
          <SettingRow label="Days Remaining">
            <span className="text-[14px]">{daysRemaining(details.expires_at)} of 7</span>
          </SettingRow>
          <SettingRow label="AI Usage">
            <span className="text-[14px] text-muted-foreground">
              Usage tracking available once the trial broker ships
            </span>
          </SettingRow>
          <button className="mt-2 px-5 py-3 bg-primary text-white rounded-xl text-[16px] font-semibold">
            Upgrade to Pro
          </button>
        </>
      ) : (
        <>
          <SettingRow label="License Key">
            <span className="text-[14px] font-mono">{details.masked_key ?? "—"}</span>
          </SettingRow>
          <SettingRow label="Device">
            <span className="text-[14px]">
              {details.activation_count ?? "?"} of {details.max_devices ?? "?"} activated
            </span>
          </SettingRow>
        </>
      )}

      <SettingRow label="Last Verified">
        <span className="text-[14px] text-muted-foreground">{timeAgo(details.last_verified_at)}</span>
      </SettingRow>
    </SectionCard>
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

      <LicenseSection />
    </div>
  );
}