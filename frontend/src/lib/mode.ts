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
