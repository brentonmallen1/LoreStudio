/**
 * Every Assistant tool in the palette, from the same registry as the Assistant tab's New menu
 * (lib/ai/sessionTypes): a tool added there is a command here, so "coach" finds both coaches.
 * Commands used to be written by hand for five of sixteen tools, and three of them sat in the
 * Editor group, which Writer mode does not hide. Kept apart from index.ts (size budget).
 */
import "../ai/sessions";
import { commandRegistry } from "./registry";
import { getAllSessionTypes, type SessionTypeConfig } from "../ai/sessionTypes";
import { AI_FEATURE_CLASS_LABELS, AI_FEATURES_BY_ID } from "../ai/features.generated";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import { useAIStore } from "../../stores/aiStore";
import { useStoryStore } from "../../stores/storyStore";
import { Users } from "lucide-react";

/** The words people reach for, beyond each tool's name and what its feature does. */
const WORDS: Record<string, string[]> = {
  "scene-assistant": ["scene", "chat", "help", "narrate"],
  "story-assistant": ["story", "arc", "plot", "theme", "chat"],
  "writing-coach": ["coach", "feedback", "critique", "improve", "prose"],
  "cliche-coach": ["coach", "cliche", "tired phrases", "fresh", "prose"],
  "story-identity-workshop": ["identity", "logline", "premise", "theme", "workshop"],
  interview: ["talk", "character", "persona", "voice", "ask"],
  panel: ["group interview", "characters", "cast", "together"],
  whatif: ["what if", "alternate", "branch", "simulate", "explore"],
  "scene-atmosphere": ["mood", "sensory", "senses", "setting"],
  "show-dont-tell": ["show", "tell", "prose"],
  "audience-adherence": ["audience", "reader", "genre", "tone"],
  "discovery-questions": ["questions", "discover", "prompts", "unknowns"],
  "book-description": ["blurb", "back cover", "description", "marketing"],
  "query-letter": ["agent", "pitch", "submission"],
  "attribute-generator": ["attributes", "suggest", "fields", "character"],
};

/** Tools with a keyboard shortcut of their own. */
const SHORTCUT: Record<string, string> = {
  "writing-coach": formatCombo(SHORTCUTS.writingCoach.combo),
};

/** In a story, not on the dashboard or a series: the Assistant works on one book. */
function inStory(): boolean {
  return window.location.pathname.startsWith("/stories/") && !!useStoryStore.getState().activeStory;
}

function start(type: SessionTypeConfig, extra: { characterId?: string } = {}) {
  const { activeStory, activeNode } = useStoryStore.getState();
  const context = type.getDefaultContext({ storyId: activeStory?.id, nodeId: activeNode?.id });
  return useAIStore.getState().createSession(type.id, { ...context, ...extra });
}

// "assistant" is Open Assistant (index.ts): it returns to the open conversation.
for (const type of getAllSessionTypes().filter((t) => t.id !== "assistant")) {
  const feature = AI_FEATURES_BY_ID[type.backendFeatureId];
  commandRegistry.register({
    id: `ai-new-${type.id}`,
    label: type.label,
    description: feature?.description,
    keywords: [
      ...(WORDS[type.id] ?? []),
      ...(feature ? [feature.label, AI_FEATURE_CLASS_LABELS[feature.classification]] : []),
      "assistant",
    ],
    icon: type.icon,
    group: "AI",
    shortcut: SHORTCUT[type.id],
    when: () => inStory() && (!type.requiresNode || !!useStoryStore.getState().activeNode),
    ...(type.requiresCharacter
      ? {
          // Choose who first, as the Assistant tab does.
          getSubItems: () =>
            useStoryStore.getState().characters.map((c) => ({
              id: `ai-new-${type.id}-${c.id}`,
              label: c.name,
              description: c.role ?? undefined,
              keywords: [c.name.toLowerCase(), type.label.toLowerCase()],
              icon: Users,
              group: "Characters",
              action: async () => void (await start(type, { characterId: c.id })),
            })),
          action: () => undefined,
        }
      : { action: async () => void (await start(type)) }),
  });
}
