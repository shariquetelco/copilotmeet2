import { create } from "zustand";
import { documentService, Document } from "@/lib/documentService";

interface DocumentStore {
  documents: Document[];
  storageUsed: number;
  loading: boolean;
  error: string | null;
  fetchDocuments: (projectId: string) => Promise<void>;
  fetchStorage: (projectId: string) => Promise<void>;
  uploadFiles: (projectId: string) => Promise<void>;
  deleteDocument: (id: string, filePath: string, projectId: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  storageUsed: 0,
  loading: false,
  error: null,

  fetchDocuments: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const documents = await documentService.list(projectId);
      set({ documents, loading: false });
      await get().fetchStorage(projectId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  fetchStorage: async (projectId) => {
    try {
      const storageUsed = await documentService.getStorageUsed(projectId);
      set({ storageUsed });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  uploadFiles: async (projectId) => {
    try {
      const paths = await documentService.pickFiles();
      if (!paths || paths.length === 0) return;

      set({ loading: true, error: null });

      const failures: string[] = [];
      for (const path of paths) {
        try {
          await documentService.upload(projectId, path);
        } catch (err) {
          // Don't let one bad file stop the rest, and always refresh
          // the list/storage after, whether this file succeeded or not.
          failures.push(String(err));
        }
      }

      await get().fetchDocuments(projectId);
      set({
        loading: false,
        error: failures.length > 0 ? failures.join(" | ") : null,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  deleteDocument: async (id, filePath, projectId) => {
    try {
      await documentService.remove(id, filePath);
      await get().fetchDocuments(projectId);
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));