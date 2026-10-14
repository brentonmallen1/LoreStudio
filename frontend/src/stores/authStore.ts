import { create } from "zustand";
import type { User } from "../types";
import { api } from "../api/client";
import { adoptAccountPrefs } from "../lib/preferences/accountPrefs";
import { systemApi } from "../api/system";
import { useStoryStore } from "./storyStore";
import { toast } from "./toastStore";

/**
 * The first sign-in of an account: the two tutorial stories go into its library (doc 26, P6).
 * Asked once; the account remembers, so a deleted one is not brought back.
 */
async function welcome(user: User): Promise<void> {
  if ((user.settings as Record<string, unknown> | undefined)?.tutorial) return;
  try {
    const { made } = await systemApi.ensureTutorial();
    if (!made.length) return;
    useStoryStore.getState().setStories(await api.listStories());
    toast.success(`${made.join(" and ")} are in your library: a lesson a scene.`);
  } catch {
    /* offline or an older server: asked again at the next sign-in */
  }
}

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
      void welcome(user);
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
      void welcome(user);
    } catch {
      localStorage.removeItem("ls_token");
      set({ user: null, token: null });
    }
  },
}));
