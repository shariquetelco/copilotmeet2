import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useAISettingsStore, LLMProvider } from "@/store/aiSettingsStore";

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

function ApiKeySection({ provider, label }: { provider: string; label: string }) {
  const apiKeys = useAISettingsStore((s) => s.apiKeys);
  const setApiKey = useAISettingsStore((s) => s.setApiKey);
  const [open, setOpen] = useState(false);
  const hasKey = Boolean(apiKeys[provider]);

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-[16px] font-medium text-foreground flex items-center gap-2">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {label}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {hasKey ? "Key saved" : "Not set"}
        </span>
      </button>
      {open && (
        <div className="pb-4 pl-6">
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={apiKeys[provider] ?? ""}
              onChange={(e) => setApiKey(provider, e.target.value)}
              placeholder="Enter API key"
              className="border border-input rounded-lg px-3 py-2 text-[16px] w-56 bg-white"
            />
            <button
              disabled
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-[14px] font-semibold cursor-not-allowed"
            >
              Verify API Key (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const providerLabels: Record<LLMProvider, string> = {
  groq: "Groq",
  claude: "Claude",
  local: "Local (Llama 3.2)",
  gemini: "Gemini",
  openai: "OpenAI",
};

const circledNumbers = ["①", "②", "③", "④", "⑤"];

export default function AISettings() {
  const {
    sttProvider,
    llmPriority,
    confidenceThreshold,
    autoOcr,
    autoFallback,
    localModel,
    hydrate,
    setSttProvider,
    setLlmPriority,
    setConfidenceThreshold,
    setAutoOcr,
    setAutoFallback,
    setLocalModel,
  } = useAISettingsStore();

  useEffect(() => {
    hydrate();
  }, []);

  const moveProvider = (index: number, direction: -1 | 1) => {
    const newOrder = [...llmPriority];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setLlmPriority(newOrder);
  };

  return (
    <div className="max-w-2xl">
      <p className="text-[16px] text-muted-foreground -mt-4 mb-6">
        Configure speech recognition, language models, and answer behavior.
      </p>

      <SectionCard title="Speech-to-Text">
        <SettingRow label="Provider">
          <select
            value={sttProvider}
            onChange={(e) => setSttProvider(e.target.value as any)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] bg-white"
          >
            <option value="whisper_local">Whisper (Local)</option>
            <option value="deepgram">Deepgram (BYOK)</option>
          </select>
        </SettingRow>

        {sttProvider === "whisper_local" && (
          <SettingRow
            label="Whisper Model"
            helper="Runs locally. Download managed separately from this screen."
          >
            <span className="text-[15px] text-muted-foreground">Small (Recommended)</span>
          </SettingRow>
        )}

        {sttProvider === "deepgram" && (
          <div className="pt-2">
            <ApiKeySection provider="deepgram" label="Deepgram API Key" />
          </div>
        )}
      </SectionCard>

      <SectionCard title="Language Model">
        <p className="text-[15px] text-muted-foreground mb-3">
          CopilotMeet tries providers from top to bottom. If one fails and Auto
          Fallback is enabled, the next provider is used automatically.
        </p>

        <div className="mb-4">
          {llmPriority.map((p, i) => (
            <div
              key={p}
              className="flex items-center justify-between py-2 border-b border-border/60 last:border-b-0"
            >
              <span className="text-[16px] font-medium text-foreground">
                {circledNumbers[i]} {providerLabels[p]}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => moveProvider(i, -1)}
                  disabled={i === 0}
                  className="px-2 py-1 text-sm rounded bg-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveProvider(i, 1)}
                  disabled={i === llmPriority.length - 1}
                  className="px-2 py-1 text-sm rounded bg-muted disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-[15px] font-bold text-muted-foreground uppercase tracking-wide mt-5 mb-1">
          API Keys
        </h3>
        <ApiKeySection provider="groq" label="Groq" />
        <ApiKeySection provider="claude" label="Claude" />
        <ApiKeySection provider="gemini" label="Gemini" />
        <ApiKeySection provider="openai" label="OpenAI" />

        {llmPriority.includes("local") && (
          <SettingRow label="Local Model" helper="Downloads managed separately.">
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-[16px] bg-white"
            >
              <option value="llama-3.2-3b">Llama 3.2 3B</option>
              <option value="qwen-3-8b">Qwen 3 8B</option>
            </select>
          </SettingRow>
        )}
      </SectionCard>

      <SectionCard title="Answer Behavior">
        <SettingRow
          label="RAG Confidence Threshold"
          helper="Only answer automatically using your documents when confidence is above this value."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-40"
            />
            <span className="text-[16px] font-semibold text-foreground w-12">
              {confidenceThreshold}%
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Auto OCR"
          helper="Automatically extract text from uploaded documents. Available once Documents are enabled."
        >
          <input
            type="checkbox"
            checked={autoOcr}
            onChange={(e) => setAutoOcr(e.target.checked)} />
        </SettingRow>

        <SettingRow
          label="Auto Fallback"
          helper="Automatically switch to the next provider if the current one fails."
        >
          <input
            type="checkbox"
            checked={autoFallback}
            onChange={(e) => setAutoFallback(e.target.checked)}
          />
        </SettingRow>
      </SectionCard>
    </div>
  );
}
