import { create } from "zustand";

export type PetStatus = "ready" | "standby" | "setup-required";
export type PetState = "idle" | "thinking" | "answering";

export interface QAEntry {
  id: string;
  question: string;
  ragAnswer: string;
  ragConfidence: number;
  llmAnswer: string;
  llmConfidence: number;
  pinned: boolean;
  timestamp: number;
}

interface PetStore {
  status: PetStatus;
  state: PetState;
  expanded: boolean;
  qaHistory: QAEntry[];
  setStatus: (status: PetStatus) => void;
  setState: (state: PetState) => void;
  setExpanded: (expanded: boolean) => void;
  addQAEntry: (entry: Omit<QAEntry, "id" | "pinned" | "timestamp">) => void;
  togglePin: (id: string) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  status: "standby",
  state: "idle",
  expanded: false,
  qaHistory: [],
  setStatus: (status) => set({ status }),
  setState: (state) => set({ state }),
  setExpanded: (expanded) => set({ expanded }),
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
}));