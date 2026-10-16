import { api } from "../api/client";
import { toolsApi } from "../api/tools";
import { useAuthStore } from "../stores/authStore";

/**
 * UI mode (refactor decision D2).
 * - writer: manuscript, structure, notes, dialogue tools, non-AI checks, export, backups.
 *   No AI affordance is rendered at all.
 * - studio: everything.
 *
 * Stored per user in `user.settings.ui.mode`. A new account is asked on its first sign-in
 * (doc 30 D4, `components/firstRun/WelcomeDialog`): the server starts it with
 * `ui.welcome = "ask"`, and until it answers it shows no AI. An account from before the
 * question has no `welcome` and keeps Studio unless it chose Writer.
 */
export type UIMode = "writer" | "studio";

type UISettings = { ui?: { mode?: string; welcome?: string; start_here?: string } } | undefined;

function readMode(settings: unknown): UIMode {
  const ui = (settings as UISettings)?.ui;
  if (ui?.mode === "writer" || ui?.mode === "studio") return ui.mode;
  // Not answered yet: nothing of the Assistant until the writer says they want it.
  return ui?.welcome === "ask" ? "writer" : "studio";
}

/** A new account that has not answered the welcome question yet. */
export function welcomePending(settings: unknown): boolean {
  return (settings as UISettings)?.ui?.welcome === "ask";
}

export function getMode(): UIMode {
  return readMode(useAuthStore.getState().user?.settings);
}

export function useMode(): UIMode {
  return readMode(useAuthStore((s) => s.user?.settings));
}

export async function setMode(mode: UIMode): Promise<void> {
  const user = await toolsApi.updateMe({ settings: { ui: { mode } } });
  useAuthStore.setState({ user });
}

/** The welcome question's answer: the mode, and never asked again. */
export async function answerWelcome(mode: UIMode): Promise<void> {
  const user = await toolsApi.updateMe({ settings: { ui: { mode, welcome: "done" } } });
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
