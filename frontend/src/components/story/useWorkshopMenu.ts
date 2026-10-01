import { Feather } from "lucide-react";
import { useAIStore } from "../../stores/aiStore";
import { useAIAvailable } from "../../lib/mode";
import type { MenuItem } from "../common/PopoverMenu";

const WORKSHOPS = [
  { label: "Workshop the logline", message: "I want to work on my logline." },
  {
    label: "Workshop the intent",
    message:
      "I'm trying to figure out what my story is really about. Help me think through my narrative intent.",
  },
  { label: "Explore the themes", message: "I want to explore the themes in my story." },
  { label: "Workshop the conflict", message: "Help me think through my central conflict." },
];

/**
 * Story Identity's Assistant actions, for the header's ⋯ menu (doc 14 Q2): one row per
 * field, each opening the Identity Workshop on that question. Nothing in Writer mode.
 */
export function useWorkshopMenu(storyId: string): MenuItem[] | undefined {
  const aiAvailable = useAIAvailable();
  const { createSession, sendMessage } = useAIStore();
  if (!aiAvailable) return undefined;
  return WORKSHOPS.map((w) => ({
    label: w.label,
    icon: Feather,
    ai: true,
    onSelect: () =>
      void createSession("story-identity-workshop", { storyId }).then((session) =>
        sendMessage(session.id, w.message),
      ),
  }));
}
