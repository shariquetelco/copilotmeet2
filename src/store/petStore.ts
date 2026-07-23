import { create } from "zustand";
import { settingsService } from "@/lib/settingsService";
import { documentService } from "@/lib/documentService";
import { projectService } from "@/lib/projectService";

export type PetStatus = "ready" | "standby" | "setup-required";
export type PetState = "idle" | "thinking" | "answering";

export interface QAEntry {
  id: string;
  question: string;
  ragAnswer: string;
  ragConfidence: number;
  llmAnswer: string;
  llmConfidence: number;
  sourceDocument?: string;
  pinned: boolean;
  timestamp: number;
}

export type PetSize = "small" | "medium" | "large";
export type PetPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface PetStore {
  status: PetStatus;
  state: PetState;
  expanded: boolean;
  qaHistory: QAEntry[];
  persona: string;
  size: PetSize;
  position: PetPosition;
  opacityIdle: number;
  alwaysOnTop: boolean;
  hydrated: boolean;
  setStatus: (status: PetStatus) => void;
  setState: (state: PetState) => void;
  setExpanded: (expanded: boolean) => void;
  setPersona: (persona: string) => void;
  setSize: (size: PetSize) => void;
  setPosition: (position: PetPosition) => void;
  setOpacityIdle: (opacity: number) => void;
  setAlwaysOnTop: (value: boolean) => void;
  addQAEntry: (entry: Omit<QAEntry, "id" | "pinned" | "timestamp">) => void;
  togglePin: (id: string) => void;
  hydrate: () => Promise<void>;
  askQuestion: (question: string) => Promise<void>;
}

export const usePetStore = create<PetStore>((set, get) => ({
  status: "standby",
  state: "idle",
  expanded: false,
  qaHistory: [],
  persona: "nova",
  size: "medium",
  position: "bottom-right",
  opacityIdle: 1,
  alwaysOnTop: true,
  hydrated: false,

  setStatus: (status) => set({ status }),
  setState: (state) => set({ state }),
  setExpanded: (expanded) => set({ expanded }),

  setPersona: (persona) => {
    set({ persona });
    settingsService.set("pet.persona", persona);
  },
  setSize: (size) => {
    set({ size });
    settingsService.set("pet.size", size);
  },
  setPosition: (position) => {
    set({ position });
    settingsService.set("pet.position", position);
  },
  setOpacityIdle: (opacityIdle) => {
    set({ opacityIdle });
    settingsService.set("pet.opacity_idle", String(opacityIdle));
  },
  setAlwaysOnTop: (alwaysOnTop) => {
    set({ alwaysOnTop });
    settingsService.set("pet.always_on_top", String(alwaysOnTop));
  },

  addQAEntry: (entry) =>
    set((s) => ({
      qaHistory: [
        ...s.qaHistory,
        { ...entry, id: crypto.randomUUID(), pinned: false, timestamp: Date.now() },
      ],
    })),
  togglePin: (id) =>
    set((s) => ({
      qaHistory: s.qaHistory.map((q) =>
        q.id === id ? { ...q, pinned: !q.pinned } : q
      ),
    })),

  askQuestion: async (question: string) => {
    const projects = await projectService.list();
    const activeProject = projects.find((p) => p.is_active);

    if (!activeProject) {
      console.warn("No active project — cannot answer.");
      return;
    }

    const answerStyle = await settingsService.get("general.answer_style");

    set({ state: "thinking" });

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const response = await invoke<{ answer: string; source_document: string | null }>(
        "ask_pet",
        {
          projectId: activeProject.id,
          question,
          answerStyle: answerStyle || "Professional",
          meetingMode: activeProject.meeting_mode,
        }
      );

      get().addQAEntry({
        question,
        ragAnswer: response.answer,
        ragConfidence: 100,
        llmAnswer: "",
        llmConfidence: 0,
        sourceDocument: response.source_document ?? undefined,
      });
    } catch (err) {
      get().addQAEntry({
        question,
        ragAnswer: `Error: ${err}`,
        ragConfidence: 0,
        llmAnswer: "",
        llmConfidence: 0,
      });
    } finally {
      set({ state: "answering" });
      setTimeout(() => set({ state: "idle" }), 2000);
    }
  },

  hydrate: async () => {
    const all = await settingsService.getAll();
    set({
      persona: all["pet.persona"] ?? get().persona,
      size: (all["pet.size"] as PetSize) ?? get().size,
      position: (all["pet.position"] as PetPosition) ?? get().position,
      opacityIdle: all["pet.opacity_idle"]
        ? parseFloat(all["pet.opacity_idle"])
        : get().opacityIdle,
      alwaysOnTop: all["pet.always_on_top"]
        ? all["pet.always_on_top"] === "true"
        : get().alwaysOnTop,
      hydrated: true,
    });
  },
}));

if (import.meta.env.DEV) {
  (window as any).petStore = usePetStore;
}