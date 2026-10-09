import { create } from "zustand";
import type { User } from "../types";
import { api } from "../api/client";
import { adoptAccountPrefs } from "../lib/preferences/accountPrefs";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("ls_token"),
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const { access_token } = await api.login(username, password);
      localStorage.setItem("ls_token", access_token);
      const user = await api.me();
      adoptAccountPrefs(user.settings);
      set({ token: access_token, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("ls_token");
    set({ user: null, token: null });
  },

  loadUser: async () => {
    const token = localStorage.getItem("ls_token");
    if (!token) return;
    try {
      const user = await api.me();
      adoptAccountPrefs(user.settings);
      set({ user, token });
    } catch {
      localStorage.removeItem("ls_token");
      set({ user: null, token: null });
    }
  },
}));
