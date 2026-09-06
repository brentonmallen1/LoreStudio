import type { AISession } from "../../stores/aiStore";
import { getSessionType } from "./sessionTypes";

/**
 * What to call a session: the name the author gave it, else the title derived from its
 * context ("Interview — Elena", "Scene Assistant — The Lamp Room").
 */
export function sessionLabel(session: AISession): string {
  if (session.title) return session.title;
  const type = getSessionType(session.type);
  return type?.contextTitle(session.context, session.resolvedNames) ?? session.type;
}
