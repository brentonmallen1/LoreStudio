import { api } from "../api/client";
import { toolsApi } from "../api/tools";
import { useAuthStore } from "../stores/authStore";

/**
 * UI mode (refactor decision D2).
 * - writer: manuscript, structure, notes, dialogue tools, non-AI checks, export, backups.
 *   No AI affordance is rendered at all.
 * - studio: everything.
 *
 * Stored per user in `user.settings.ui.mode`. Existing accounts default to studio;
 * the first-run choice for new users arrives with the Stage 2 shell work.
 */
export type UIMode = "writer" | "studio";

export function getMode(): UIMode {
  const settings = useAuthStore.getState().user?.settings as { ui?: { mode?: string } } | undefined;
  return settings?.ui?.mode === "writer" ? "writer" : "studio";
}

export function useMode(): UIMode {
  const settings = useAuthStore((s) => s.user?.settings) as { ui?: { mode?: string } } | undefined;
  return settings?.ui?.mode === "writer" ? "writer" : "studio";
}

export async function setMode(mode: UIMode): Promise<void> {
  const user = await toolsApi.updateMe({ settings: { ui: { mode } } });
  useAuthStore.setState({ user });
}

/**
 * The AI master switch (doc 06 §7), stored in `user.settings.ai.enabled`.
 *
 * Writer mode hides AI because the mode has no use for it; this switch hides AI because
 * the author said no. Both must render nothing, and with the switch off the gateway
 * refuses calls too — hiding a button is a UI decision, this is a promise.
 */
function readAIEnabled(settings: unknown): boolean {
  return (settings as { ai?: { enabled?: boolean } } | undefined)?.ai?.enabled !== false;
}

export function getAIEnabled(): boolean {
  return readAIEnabled(useAuthStore.getState().user?.settings);
}

/** True when AI surfaces should render at all: Studio mode and the switch on. */
export function useAIAvailable(): boolean {
  const settings = useAuthStore((s) => s.user?.settings);
  return useMode() === "studio" && readAIEnabled(settings);
}

export function getAIAvailable(): boolean {
  return getMode() === "studio" && getAIEnabled();
}

/** Flip the switch and reflect it in the cached user, so every guard updates at once. */
export async function setAIEnabled(enabled: boolean): Promise<void> {
  await api.updateAISettings({ enabled });
  const user = useAuthStore.getState().user;
  if (!user) return;
  const settings = (user.settings ?? {}) as Record<string, unknown>;
  const ai = (settings.ai ?? {}) as Record<string, unknown>;
  useAuthStore.setState({ user: { ...user, settings: { ...settings, ai: { ...ai, enabled } } } });
}
