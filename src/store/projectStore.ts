import { create } from "zustand";
import { projectService, Project } from "@/lib/projectService";

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, meetingMode: string) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectService.list();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createProject: async (name, meetingMode) => {
    try {
      await projectService.create(name, meetingMode);
      await get().fetchProjects();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  updateProject: async (project) => {
    try {
      await projectService.update(project);
      await get().fetchProjects();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  deleteProject: async (id) => {
    try {
      await projectService.remove(id);
      await get().fetchProjects();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setActiveProject: async (id) => {
    try {
      await projectService.setActive(id);
      await get().fetchProjects();
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));