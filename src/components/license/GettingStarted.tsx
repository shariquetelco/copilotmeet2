import { useState } from "react";
import { useAISettingsStore, LLMProvider } from "@/store/aiSettingsStore";

type Step = "choice" | "deepgram" | "llm" | "done";

const PROVIDER_LINKS: Record<string, string> = {
  groq: "https://console.groq.com/keys",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
};

export default function GettingStarted({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("choice");
  const [deepgramKey, setDeepgramKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"groq" | "openai" | "claude">("groq");
  const [llmKey, setLlmKey] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const setApiKey = useAISettingsStore((s) => s.setApiKey);
  const setLlmPriority = useAISettingsStore((s) => s.setLlmPriority);

  async function verifyAndSave(provider: string, key: string, onSuccess: () => void) {
    setStatus("checking");
    setError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("verify_provider_key", { provider, key });
      await setApiKey(provider, key);
      setStatus("success");
      onSuccess();
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  }

  function finish() {
    onComplete();
  }

  if (step === "choice") {
    return (
      <Shell title="🎉 Welcome to CopilotMeet">
        <p className="text-[15px] text-muted-foreground mb-6">You're ready to go. How would you like to power AI?</p>
        <button
          onClick={finish}
          className="w-full text-left border border-border rounded-xl p-4 mb-3 hover:border-primary"
        >
          <div className="font-semibold text-[15px]">Use CopilotMeet Credits (Recommended)</div>
          <div className="text-[13px] text-muted-foreground">No API keys required.</div>
        </button>
        <button
          onClick={() => setStep("deepgram")}
          className="w-full text-left border border-border rounded-xl p-4 hover:border-primary"
        >
          <div className="font-semibold text-[15px]">Bring Your Own API Keys</div>
          <div className="text-[13px] text-muted-foreground">Use your own Groq, OpenAI, or Claude keys.</div>
        </button>
        <button onClick={finish} className="text-[13px] text-muted-foreground mt-6 underline">
          Skip for now
        </button>
      </Shell>
    );
  }

  if (step === "deepgram") {
    return (
      <Shell title="Step 1 of 2 — Speech Recognition">
        <p className="text-[15px] text-muted-foreground mb-1">You'll need a Deepgram API key.</p>
        <a href="https://console.deepgram.com/signup" target="_blank" rel="noreferrer" className="text-[14px] text-primary underline mb-4 inline-block">Get API Key ↗</a>
        <input
          type="password"
          value={deepgramKey}
          onChange={(e) => {
            setDeepgramKey(e.target.value);
            setStatus("idle");
          }}
          placeholder="Paste key here"
          className="w-full border border-input rounded-lg px-3 py-2 text-[15px] mb-2"
        />
        <button
          onClick={() =>
            verifyAndSave("deepgram", deepgramKey, () =>
              setTimeout(() => {
                setStatus("idle");
                setStep("llm");
              }, 600)
            )
          }
          disabled={!deepgramKey || status === "checking"}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[14px] font-semibold disabled:opacity-50"
        >
          {status === "checking" ? "Verifying..." : "Verify"}
        </button>
        {status === "success" && <span className="text-green-600 text-[14px] ml-3">✓ Connected</span>}
        {status === "error" && <p className="text-red-600 text-[13px] mt-2">{error}</p>}
        <button onClick={finish} className="block text-[13px] text-muted-foreground mt-6 underline">
          Skip for now
        </button>
      </Shell>
    );
  }

  if (step === "llm") {
    return (
      <Shell title="Step 2 of 2 — Choose your AI provider">
        <div className="flex flex-col gap-2 mb-4">
          {(["groq", "openai", "claude"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 text-[15px] capitalize">
              <input
                type="radio"
                checked={llmProvider === p}
                onChange={() => {
                  setLlmProvider(p);
                  setStatus("idle");
                  setLlmKey("");
                }}
              />
              {p}
            </label>
          ))}
        </div>
        <a href={PROVIDER_LINKS[llmProvider]} target="_blank" rel="noreferrer" className="text-[14px] text-primary underline mb-4 inline-block">Get API Key ↗</a>
        <input
          type="password"
          value={llmKey}
          onChange={(e) => {
            setLlmKey(e.target.value);
            setStatus("idle");
          }}
          placeholder="Paste key here"
          className="w-full border border-input rounded-lg px-3 py-2 text-[15px] mb-2"
        />
        <button
          onClick={() =>
            verifyAndSave(llmProvider, llmKey, () => {
              const currentPriority = useAISettingsStore.getState().llmPriority;
              const reordered = [
                llmProvider,
                ...currentPriority.filter((p) => p !== llmProvider),
              ] as LLMProvider[];
              setLlmPriority(reordered);
              setTimeout(() => setStep("done"), 600);
            })
          }
          disabled={!llmKey || status === "checking"}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[14px] font-semibold disabled:opacity-50"
        >
          {status === "checking" ? "Verifying..." : "Verify"}
        </button>
        {status === "success" && <span className="text-green-600 text-[14px] ml-3">✓ Connected</span>}
        {status === "error" && <p className="text-red-600 text-[13px] mt-2">{error}</p>}
        <button onClick={finish} className="block text-[13px] text-muted-foreground mt-6 underline">
          Skip for now
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="Everything is ready">
      <p className="text-[15px] text-muted-foreground mb-6">Deepgram ✓ &nbsp; {llmProvider} ✓</p>
      <button onClick={finish} className="px-6 py-3 bg-primary text-white rounded-xl text-[15px] font-semibold">
        Start Meeting
      </button>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm">
        <h1 className="text-xl font-bold mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}