import { create } from "zustand";
import { api } from "../api/client";

interface HealthStore {
  alertCount: number;
  absentCharacters: string[];
  miceViolationCount: number;
  refreshAlerts: (storyId: string) => Promise<void>;
}

export const useHealthStore = create<HealthStore>((set) => ({
  alertCount: 0,
  absentCharacters: [],
  miceViolationCount: 0,

  refreshAlerts: async (storyId) => {
    try {
      const data = await api.getHealthAlerts(storyId);
      set({
        alertCount: data.count,
        absentCharacters: data.absent_characters,
        miceViolationCount: data.mice_violation_count,
      });
    } catch {
      // silently ignore — health badge is non-critical
    }
  },
}));
