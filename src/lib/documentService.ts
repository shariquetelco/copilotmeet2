import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface Document {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  file_type: string;
  status: string;
  created_at: string;
}

export const documentService = {
  pickFiles: (): Promise<string[] | null> =>
    open({
      multiple: true,
      filters: [
        {
          name: "Documents",
          extensions: ["pdf", "docx", "pptx", "xlsx", "txt", "md", "png", "jpg", "jpeg"],
        },
      ],
    }),

  upload: (projectId: string, sourcePath: string): Promise<Document> =>
    invoke("upload_document", { projectId, sourcePath }),

  list: (projectId: string): Promise<Document[]> =>
    invoke("list_documents", { projectId }),

  remove: (id: string, filePath: string): Promise<void> =>
    invoke("delete_document", { id, filePath }),

  getStorageUsed: (projectId: string): Promise<number> =>
    invoke("get_project_storage", { projectId }),
};

export const FREE_TIER_LIMIT_BYTES = 5 * 1024 * 1024;