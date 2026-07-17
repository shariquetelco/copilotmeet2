import { invoke } from "@tauri-apps/api/core";

export const apiKeyService = {
  set: (provider: string, key: string): Promise<void> =>
    invoke("set_api_key", { provider, key }),

  get: (provider: string): Promise<string | null> =>
    invoke("get_api_key", { provider }),

  remove: (provider: string): Promise<void> =>
    invoke("delete_api_key", { provider }),
};