import { create } from "zustand";
import { settingsService } from "@/lib/settingsService";
import { documentService } from "@/lib/documentService";
import { projectService } from "@/lib/projectService";

export type PetStatus = "ready" | "standby" | "setup-required";
export type PetState = "idle" | "thinking" | "answering";
export type SessionStatus =
  | "Stopped"
  | "Connecting..."
  | "Listening..."
  | "Question detected"
  | "Error";

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
  selectedProjectId: string | null; // null = use active project, "__all__" = search everything
  streamingEntryId: string | null;
  listening: boolean;
  sessionStatus: SessionStatus;
  questionsDetected: number;
  toggleListening: () => Promise<void>;
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
  setSelectedProjectId: (id: string | null) => void;
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
  streamingEntryId: null,
  listening: false,
  sessionStatus: "Stopped" as SessionStatus,
  questionsDetected: 0,

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

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  toggleListening: async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const { listening } = get();

    if (listening) {
      await invoke("stop_meeting_session");
      set({ listening: false, sessionStatus: "Stopped" });
      return;
    }

    set({ listening: true, sessionStatus: "Connecting..." });
    try {
      const { selectedProjectId } = get();
      let projectId: string | undefined;

      if (selectedProjectId && selectedProjectId !== "__all__") {
        projectId = selectedProjectId;
      } else if (!selectedProjectId) {
        const projects = await projectService.list();
        projectId = projects.find((p: any) => p.is_active)?.id;
      }

      await invoke("start_meeting_session", { projectId });
      set({ sessionStatus: "Listening..." });
    } catch (err) {
      console.error("Failed to start session:", err);
      set({ listening: false, sessionStatus: "Error" });
    }
  },

  askQuestion: async (question: string) => {
    const projects = await projectService.list();
    const activeProject = projects.find((p) => p.is_active);
    const { selectedProjectId } = get();

    if (!activeProject && selectedProjectId !== "__all__") {
      console.warn("No active project — cannot answer.");
      return;
    }

    const meetingMode =
      selectedProjectId && selectedProjectId !== "__all__"
        ? projects.find((p) => p.id === selectedProjectId)?.meeting_mode ?? "Interview"
        : activeProject?.meeting_mode ?? "Interview";

    const projectIdToSearch =
      selectedProjectId === "__all__"
        ? undefined
        : selectedProjectId ?? activeProject?.id;

    const answerStyle = await settingsService.get("general.answer_style");

    set({ state: "thinking" });

    const entryId = crypto.randomUUID();
    set((s) => ({
      qaHistory: [
        ...s.qaHistory,
        {
          id: entryId,
          question,
          ragAnswer: "",
          ragConfidence: 100,
          llmAnswer: "",
          llmConfidence: 0,
          pinned: false,
          timestamp: Date.now(),
        },
      ],
      streamingEntryId: entryId,
    }));

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const response = await invoke<{ answer: string; source_document: string | null }>(
        "ask_pet",
        {
          projectId: projectIdToSearch,
          question,
          answerStyle: answerStyle || "Professional",
          meetingMode,
        }
      );

      set((s) => ({
        qaHistory: s.qaHistory.map((q) =>
          q.id === entryId
            ? { ...q, ragAnswer: response.answer, sourceDocument: response.source_document ?? undefined }
            : q
        ),
      }));
    } catch (err) {
      set((s) => ({
        qaHistory: s.qaHistory.map((q) =>
          q.id === entryId ? { ...q, ragAnswer: `Error: ${err}` } : q
        ),
      }));
    } finally {
      set({ state: "answering", streamingEntryId: null });
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

if (typeof window !== "undefined") {
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("question_detected", (event) => {
      usePetStore.setState((s) => ({
        sessionStatus: "Question detected",
        questionsDetected: s.questionsDetected + 1,
      }));

      usePetStore.getState().askQuestion(event.payload);

      setTimeout(() => {
        usePetStore.setState((s) =>
          s.listening ? { sessionStatus: "Listening..." } : s
        );
      }, 2000);
    });

    listen<string>("answer_chunk", (event) => {
      const { streamingEntryId } = usePetStore.getState();
      if (!streamingEntryId) return;
      usePetStore.setState((s) => ({
        qaHistory: s.qaHistory.map((q) =>
          q.id === streamingEntryId
            ? { ...q, ragAnswer: q.ragAnswer + event.payload }
            : q
        ),
      }));
    });

    listen("answer_done", () => {
      usePetStore.setState({ streamingEntryId: null });
    });
  });
}

if (import.meta.env.DEV) {
  (window as any).petStore = usePetStore;
}