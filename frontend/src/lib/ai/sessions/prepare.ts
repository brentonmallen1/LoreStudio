/**
 * Prepare — non-manuscript drafts the author rewrites.
 * Registered on import; see ./index.ts.
 */
import { Feather, Wand2 } from "lucide-react";
import { registerSessionType } from "../sessionTypes";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";

// ── Book Description Generator ────────────────────────────────────────────────

registerSessionType({
  id: "book-description",
  label: "Book Description",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Book Description — ${names.storyTitle}` : "Book Description",
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Feather,
  accentVar: "--color-ai",
  backendFeatureId: "book-description",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
  }),

  getContextItems: () => {
    const { stories } = useStoryStore.getState();
    return stories.map((s) => ({ id: s.id, label: s.title }));
  },

  initSession: async (_ctx) => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId } = session.context;
    if (!storyId) throw new Error("Story required for Book Description");
    return api.sendBookDescriptionMessage(
      storyId,
      session.messages,
      signal,
      llmParams,
      session.mentionedRefs,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Query Letter Drafting ─────────────────────────────────────────────────────

registerSessionType({
  id: "query-letter",
  label: "Query Letter",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Query Letter — ${names.storyTitle}` : "Query Letter"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Feather,
  accentVar: "--color-ai",
  backendFeatureId: "query-letter",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
  }),

  getContextItems: () => {
    const { stories } = useStoryStore.getState();
    return stories.map((s) => ({ id: s.id, label: s.title }));
  },

  initSession: async (_ctx) => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId } = session.context;
    if (!storyId) throw new Error("Story required for Query Letter");
    return api.sendQueryLetterMessage(storyId, session.messages, signal, llmParams, session.mentionedRefs);
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Attribute Generator ───────────────────────────────────────────────────────

registerSessionType({
  id: "attribute-generator",
  label: "Attribute Suggestions",
  contextTitle: (_ctx, names) =>
    names.characterName ? `Attributes — ${names.characterName}` : "Attribute Suggestions",
  contextItemLabel: (_, names) => names.characterName ?? "Character",
  icon: Wand2,
  accentVar: "--color-ai",
  backendFeatureId: "character-attributes",

  requiresStory: false,
  requiresCharacter: true,
  requiresNode: false,

  getDefaultContext: () => ({}),

  getContextItems: () => {
    const chars = useStoryStore.getState().characters;
    return chars.map((c) => ({ id: c.id, label: c.name }));
  },

  initSession: async (_ctx) => ({}),

  // Not used — the mode component calls api.generateAttributes() directly
  sendMessage: () => {
    throw new Error("Attribute Generator uses direct API call, not sendMessage");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});
