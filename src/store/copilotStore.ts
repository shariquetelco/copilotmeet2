import { create } from "zustand";

export type CopilotStatus = "ready" | "standby" | "setup-required";
export type CopilotState = "idle" | "thinking" | "answering";

interface CopilotStore {
  status: CopilotStatus;
  state: CopilotState;
  expanded: boolean;
  setStatus: (status: CopilotStatus) => void;
  setState: (state: CopilotState) => void;
  setExpanded: (expanded: boolean) => void;
}

export const useCopilotStore = create<CopilotStore>((set) => ({
  status: "standby",
  state: "idle",
  expanded: false,
  setStatus: (status) => set({ status }),
  setState: (state) => set({ state }),
  setExpanded: (expanded) => set({ expanded }),
}));