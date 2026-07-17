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
}

export const usePetStore = create<PetStore>((set) => ({
  status: "standby",
  state: "idle",
  expanded: false,
  qaHistory: [],
  persona: "nova",
  size: "medium",
  position: "bottom-right",
  opacityIdle: 1,
  alwaysOnTop: true,
  setStatus: (status) => set({ status }),
  setState: (state) => set({ state }),
  setExpanded: (expanded) => set({ expanded }),
  setPersona: (persona) => set({ persona }),
  setSize: (size) => set({ size }),
  setPosition: (position) => set({ position }),
  setOpacityIdle: (opacityIdle) => set({ opacityIdle }),
  setAlwaysOnTop: (alwaysOnTop) => set({ alwaysOnTop }),
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

if (import.meta.env.DEV) {
  (window as any).petStore = usePetStore;
}