import { create } from "zustand";
import { apiKeyService } from "@/lib/apiKeyService";
import { settingsService } from "@/lib/settingsService";

export type STTProvider = "whisper_local" | "deepgram";
export const LLM_PROVIDERS = ["groq", "openai", "claude", "gemini", "local"] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

interface AISettingsStore {
  sttProvider: STTProvider;
  llmPriority: LLMProvider[];
  confidenceThreshold: number;
  autoOcr: boolean;
  autoFallback: boolean;
  localModel: string;
  apiKeys: Record<string, string>;
  hydrated: boolean;

  setSttProvider: (p: STTProvider) => void;
  setLlmPriority: (order: LLMProvider[]) => void;
  setConfidenceThreshold: (v: number) => void;
  setAutoOcr: (v: boolean) => void;
  setAutoFallback: (v: boolean) => void;
  setLocalModel: (v: string) => void;
  setApiKey: (provider: string, key: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAISettingsStore = create<AISettingsStore>((set, get) => ({
  sttProvider: "whisper_local",
  llmPriority: ["groq", "openai", "claude", "gemini", "local"],
  confidenceThreshold: 85,
  autoOcr: true,
  autoFallback: true,
  localModel: "llama-3.2-3b",
  apiKeys: {},
  hydrated: false,

  setSttProvider: (sttProvider) => {
    set({ sttProvider });
    settingsService.set("ai.stt_provider", sttProvider);
  },
  setLlmPriority: (llmPriority) => {
    set({ llmPriority });
    settingsService.set("ai.llm_provider_priority", JSON.stringify(llmPriority));
  },
  setConfidenceThreshold: (confidenceThreshold) => {
    set({ confidenceThreshold });
    settingsService.set("ai.confidence_threshold", String(confidenceThreshold));
  },
  setAutoOcr: (autoOcr) => {
    set({ autoOcr });
    settingsService.set("ai.auto_ocr", String(autoOcr));
  },
  setAutoFallback: (autoFallback) => {
    set({ autoFallback });
    settingsService.set("ai.auto_fallback", String(autoFallback));
  },
  setLocalModel: (localModel) => {
    set({ localModel });
    settingsService.set("ai.local_model", localModel);
  },
  setApiKey: async (provider, key) => {
    await apiKeyService.set(provider, key);
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } }));
  },

  hydrate: async () => {
    const all = await settingsService.getAll();
    const keys: Record<string, string> = {};
    for (const provider of ["deepgram", "groq", "openai", "claude", "gemini"]) {
      const key = await apiKeyService.get(provider);
      if (key) keys[provider] = key;
    }
    set({
      sttProvider: (all["ai.stt_provider"] as STTProvider) ?? get().sttProvider,
      llmPriority: all["ai.llm_provider_priority"]
        ? JSON.parse(all["ai.llm_provider_priority"])
        : get().llmPriority,
      confidenceThreshold: all["ai.confidence_threshold"]
        ? parseFloat(all["ai.confidence_threshold"])
        : get().confidenceThreshold,
      autoOcr: all["ai.auto_ocr"] ? all["ai.auto_ocr"] === "true" : get().autoOcr,
      autoFallback: all["ai.auto_fallback"]
        ? all["ai.auto_fallback"] === "true"
        : get().autoFallback,
      localModel: all["ai.local_model"] ?? get().localModel,
      apiKeys: keys,
      hydrated: true,
    });
  },
}));