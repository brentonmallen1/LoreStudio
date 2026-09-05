import { create } from "zustand";
import { api } from "../api/client";
import type { DiscoveredElement } from "../types";

interface DiscoveryStore {
  discoveries: DiscoveredElement[];
  pendingCount: number;
  isAnalyzing: boolean;
  loadDiscoveries: (storyId: string) => Promise<void>;
  refreshCount: (storyId: string) => Promise<void>;
  runDiscovery: (storyId: string, nodeId?: string) => Promise<DiscoveredElement[]>;
  approveDiscovery: (elementId: string, overrides?: { name?: string; description?: string }) => Promise<void>;
  rejectDiscovery: (elementId: string) => Promise<void>;
  deleteDiscovery: (elementId: string) => Promise<void>;
}

export const useDiscoveryStore = create<DiscoveryStore>((set) => ({
  discoveries: [],
  pendingCount: 0,
  isAnalyzing: false,

  loadDiscoveries: async (storyId) => {
    const discoveries = await api.listDiscoveries(storyId, "pending");
    set({ discoveries, pendingCount: discoveries.length });
  },

  refreshCount: async (storyId) => {
    const { count } = await api.countPendingDiscoveries(storyId);
    set({ pendingCount: count });
  },

  runDiscovery: async (storyId, nodeId) => {
    set({ isAnalyzing: true });
    try {
      const created = await api.runDiscovery(storyId, nodeId);
      set((state) => ({
        discoveries: [...created, ...state.discoveries],
        pendingCount: state.pendingCount + created.length,
      }));
      return created;
    } finally {
      set({ isAnalyzing: false });
    }
  },

  approveDiscovery: async (elementId, overrides) => {
    await api.approveDiscovery(elementId, overrides);
    set((state) => ({
      discoveries: state.discoveries.filter((d) => d.id !== elementId),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  rejectDiscovery: async (elementId) => {
    await api.rejectDiscovery(elementId);
    set((state) => ({
      discoveries: state.discoveries.filter((d) => d.id !== elementId),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  deleteDiscovery: async (elementId) => {
    await api.deleteDiscovery(elementId);
    set((state) => ({
      discoveries: state.discoveries.filter((d) => d.id !== elementId),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },
}));
