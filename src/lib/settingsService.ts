import { invoke } from "@tauri-apps/api/core";

export const settingsService = {
  get: (key: string): Promise<string | null> =>
    invoke("get_setting", { key }),

  set: (key: string, value: string): Promise<void> =>
    invoke("set_setting", { key, value }),

  getAll: (): Promise<Record<string, string>> =>
    invoke("get_all_settings"),

  remove: (key: string): Promise<void> =>
    invoke("delete_setting", { key }),
};