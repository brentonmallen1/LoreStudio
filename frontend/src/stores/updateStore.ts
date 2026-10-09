import { create } from "zustand";
import { systemApi } from "../api/system";
import type { UpdateStatus } from "../types/system";

/**
 * Is there a newer LoreStudio? Read once a visit for the logo menu and Settings › About.
 * The answer comes from the last check (Check now, or the daily check when it is on), so
 * reading it never contacts GitHub.
 */
interface UpdateState {
  status: UpdateStatus | null;
  checking: boolean;
  load: () => Promise<void>;
  check: () => Promise<UpdateStatus>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: null,
  checking: false,
  load: async () => {
    if (get().status) return;
    try {
      set({ status: await systemApi.updateStatus() });
    } catch {
      /* not signed in yet, or offline: the menu simply says nothing */
    }
  },
  check: async () => {
    set({ checking: true });
    try {
      const status = await systemApi.checkForUpdate();
      set({ status });
      return status;
    } finally {
      set({ checking: false });
    }
  },
}));
