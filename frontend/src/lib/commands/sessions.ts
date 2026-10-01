/**
 * Conversations that used to be pages (doc 12 P6): What If and Group Interviews start in
 * the Assistant tab. Kept apart from index.ts, which is at its size budget.
 */
import { MessageSquareMore, Shuffle } from "lucide-react";
import { commandRegistry } from "./registry";
import { getSessionType } from "../ai/sessionTypes";
import { useAIStore } from "../../stores/aiStore";
import { useStoryStore } from "../../stores/storyStore";

const SESSIONS = [
  {
    id: "ai-new-whatif",
    type: "whatif",
    label: "New What-If",
    keywords: ["what if", "whatif", "alternate", "explore", "simulate"],
    icon: Shuffle,
  },
  {
    id: "ai-new-panel",
    type: "panel",
    label: "New Group Interview",
    keywords: ["panel", "group interview", "interview", "characters", "cast"],
    icon: MessageSquareMore,
  },
];

for (const s of SESSIONS) {
  commandRegistry.register({
    id: s.id,
    label: s.label,
    keywords: s.keywords,
    icon: s.icon,
    group: "AI",
    when: () => !!useStoryStore.getState().activeStory,
    action: async () => {
      const { activeStory, activeNode } = useStoryStore.getState();
      const spec = getSessionType(s.type);
      if (!activeStory || !spec) return;
      await useAIStore
        .getState()
        .createSession(s.type, spec.getDefaultContext({ storyId: activeStory.id, nodeId: activeNode?.id }));
    },
  });
}
