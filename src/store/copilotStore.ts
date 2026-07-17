import { create } from "zustand";

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

interface CopilotStore {
  status: CopilotStatus;
  state: CopilotState;
  expanded: boolean;
  qaHistory: QAEntry[];
  setStatus: (status: CopilotStatus) => void;
  setState: (state: CopilotState) => void;
  setExpanded: (expanded: boolean) => void;
  addQAEntry: (entry: Omit<QAEntry, "id" | "pinned" | "timestamp">) => void;
  togglePin: (id: string) => void;
}

export const useCopilotStore = create<CopilotStore>((set) => ({
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