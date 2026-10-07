import { api } from "../../api/client";

/**
 * A conversation's Think first, kept on the Chronicle's record of it (chat_sessions.thinking),
 * so a conversation resumed after a reload or on another device thinks as it was left.
 *
 * Chats know their record's id once the first reply names it. Interviews and panels are known
 * by their own id, which their record keeps as `context_id`, so theirs is looked up.
 */
interface Conversation {
  type: string;
  chronicleSessionId?: string;
  backendSessionId?: string;
  context: { storyId?: string };
}

const BY_OWN_ID: Record<string, string> = { interview: "interview", panel: "panel" };

async function record(c: Conversation): Promise<{ id: string; thinking?: boolean | null } | null> {
  if (c.chronicleSessionId) return { id: c.chronicleSessionId };
  const kind = BY_OWN_ID[c.type];
  if (!kind || !c.backendSessionId) return null;
  const found = await api.listChronicleSessions({
    story_id: c.context.storyId,
    context_type: kind,
    context_id: c.backendSessionId,
    page_size: 1,
  });
  return found.sessions[0] ?? null;
}

/** Save the choice (or clear it) on the conversation's record, if it has one yet. */
export async function saveThinking(c: Conversation, thinking: boolean | undefined): Promise<void> {
  const found = await record(c).catch(() => null);
  if (found)
    await api.updateChronicleSession(found.id, { thinking: thinking ?? null }).catch(() => undefined);
}

/** The choice a resumed conversation was left with, or undefined to follow its default. */
export async function loadThinking(c: Conversation): Promise<boolean | undefined> {
  const found = await record(c).catch(() => null);
  if (!found) return undefined;
  const thinking =
    "thinking" in found
      ? found.thinking
      : (await api.getChronicleSession(found.id).catch(() => null))?.thinking;
  return thinking ?? undefined;
}
