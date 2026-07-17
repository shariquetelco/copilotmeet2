import { invoke } from "@tauri-apps/api/core";

export interface Project {
  id: string;
  name: string;
  meeting_mode: string;
  llm_profile: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const projectService = {
  create: (name: string, meeting_mode: string, color: string): Promise<Project> =>
    invoke("create_project", { name, meetingMode: meeting_mode, color }),

  list: (): Promise<Project[]> => invoke("list_projects"),

  update: (project: Project): Promise<Project> =>
    invoke("update_project", { project }),

  remove: (id: string): Promise<void> => invoke("delete_project", { id }),

  setActive: (id: string): Promise<void> => invoke("set_active_project", { id }),
};