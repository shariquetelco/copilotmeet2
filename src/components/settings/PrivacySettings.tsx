import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import { DatabaseZap, CheckCircle2 } from "lucide-react";

function SettingRow({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-medium text-foreground">{label}</span>
        {children}
      </div>
      {helper && <p className="text-[14px] text-muted-foreground mt-1">{helper}</p>}
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

export default function PrivacySettings() {
  const { getSetting, updateSetting, fetchSettings } = useSettingsStore();
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimized(false);
    try {
      await invoke("optimize_database");
      setOptimized(true);
      setTimeout(() => setOptimized(false), 3000);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-[16px] text-muted-foreground -mt-4 mb-6">
        Everything stays on your device. Control what's saved and keep your data tidy.
      </p>

      <SectionCard title="Data">
        <SettingRow
          label="Save Transcript"
          helper="Keep the full conversation transcript with each saved session."
        >
          <input
            type="checkbox"
            checked={getSetting("privacy.save_transcript", "true") === "true"}
            onChange={(e) => updateSetting("privacy.save_transcript", String(e.target.checked))}
            className="w-5 h-5"
          />
        </SettingRow>

        <SettingRow
          label="Save Session"
          helper="Ask before saving a session when a meeting ends."
        >
          <input
            type="checkbox"
            checked={getSetting("privacy.save_session", "true") === "true"}
            onChange={(e) => updateSetting("privacy.save_session", String(e.target.checked))}
            className="w-5 h-5"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Diagnostics">
        <SettingRow
          label="Anonymous Crash Reports"
          helper="Help improve CopilotMeet by sharing crash reports. No personal data is included."
        >
          <input
            type="checkbox"
            checked={getSetting("privacy.crash_reports", "false") === "true"}
            onChange={(e) => updateSetting("privacy.crash_reports", String(e.target.checked))}
            className="w-5 h-5"
          />
        </SettingRow>

        <SettingRow
          label="Anonymous Telemetry"
          helper="Share anonymous usage data to help us improve the product."
        >
          <input
            type="checkbox"
            checked={getSetting("privacy.telemetry", "false") === "true"}
            onChange={(e) => updateSetting("privacy.telemetry", String(e.target.checked))}
            className="w-5 h-5"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Storage">
        <SettingRow
          label="Optimize Database"
          helper="Reclaims unused space and keeps your local database running smoothly."
        >
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className={`px-4 py-2 rounded-lg text-[15px] font-semibold flex items-center gap-2 transition-colors ${
              optimized
                ? "bg-green-100 text-success"
                : "bg-primary text-white hover:opacity-90"
            } disabled:opacity-60`}
          >
            {optimized ? (
              <>
                <CheckCircle2 size={16} />
                Optimized
              </>
            ) : (
              <>
                <DatabaseZap size={16} />
                {optimizing ? "Optimizing…" : "Optimize Database"}
              </>
            )}
          </button>
        </SettingRow>
      </SectionCard>
    </div>
  );
}