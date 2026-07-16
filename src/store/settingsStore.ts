import { create } from "zustand";
import { settingsService } from "@/lib/settingsService";

interface SettingsStore {
  settings: Record<string, string>;
  loading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  getSetting: (key: string, fallback?: string) => string | undefined;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await settingsService.getAll();
      set({ settings, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  updateSetting: async (key, value) => {
    try {
      await settingsService.set(key, value);
      set((s) => ({ settings: { ...s.settings, [key]: value } }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  getSetting: (key, fallback) => {
    return get().settings[key] ?? fallback;
  },
}));