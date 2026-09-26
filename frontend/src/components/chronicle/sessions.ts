import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAIStore } from "../../stores/aiStore";
import type { ChronicleSession } from "../../types";

export const CONTEXT_LABELS: Record<string, string> = {
  scene: "Scene",
  character: "Character",
  story: "Story",
  panel: "Group Interview",
};

export function sessionTitle(s: ChronicleSession): string {
  if (s.title) return s.title;
  const label = CONTEXT_LABELS[s.context_type] ?? s.context_type;
  return s.context_label ? `${label}: ${s.context_label}` : label;
}

/** Reopen a past conversation in the AI panel, with its messages. */
export function useResumeSession() {
  const navigate = useNavigate();
  const { resumeFromChronicle } = useAIStore();
  return async (s: ChronicleSession) => {
    try {
      const detail = await api.getChronicleSession(s.id);
      const messages = detail.messages.map((m) => ({ role: m.role, content: m.content }));
      await resumeFromChronicle(s.id, s.context_type, s.context_id, s.story_id, s.context_label, messages);
      navigate(`/stories/${s.story_id}`);
    } catch {
      // A conversation that cannot be reopened stays readable here.
    }
  };
}
