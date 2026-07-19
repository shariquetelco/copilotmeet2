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

  getJob: (documentId: string): Promise<DocumentJob | null> =>
    invoke("get_document_job", { documentId }),

  search: (projectId: string, query: string, topK: number = 5): Promise<SearchResult[]> =>
    invoke("search_documents", { projectId, query, topK }),
};

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  distance: number;
}

export interface DocumentJob {
  id: string;
  document_id: string;
  stage: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const FREE_TIER_LIMIT_BYTES = 5 * 1024 * 1024;