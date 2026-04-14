import type { ComponentType } from "react";
import type { LLMParams } from "../../types";

/**
 * How much story context to include in the AI's context window.
 * - current-scene: Only the active scene (default for scene-focused modes)
 * - entire-story: Full lorebook + story structure (default for story-level modes)
 * - lorebook-only: World/character data only, no manuscript content
 */
export type ContextScope = "current-scene" | "entire-story" | "lorebook-only";

export const SCOPE_LABELS: Record<ContextScope, string> = {
  "current-scene": "Scene",
  "entire-story": "Full story",
  "lorebook-only": "Lorebook",
};

/**
 * The runtime context for an AI session.
 * All fields are optional — each session type uses a subset.
 */
export interface SessionContext {
  storyId?: string;
  characterId?: string;
  nodeId?: string;
  characterIds?: string[];  // For panel interviews
  selectedText?: string;    // For writing-coach sessions: the highlighted text
  tonePrefs?: string[];     // For writing-coach sessions: e.g. ["darker", "direct"]
  contextScope?: ContextScope; // How much story context to include
  contextOptions?: import("../../types").ContextOptions; // Selective context toggles
  attributeType?: string;      // For attribute-generator sessions
}

/** A single context option shown in the context picker dropdown */
export interface ContextOption {
  id: string;
  label: string;
  indent?: number;  // Visual indentation level for nested items
}

/**
 * Defines all behavior for a session type.
 * Register new types in SESSION_TYPE_REGISTRY below.
 */
export interface SessionTypeConfig {
  id: string;
  /** Short display label, e.g. "Interview" */
  label: string;
  /** Full contextual title, shown in the panel header */
  contextTitle: (ctx: SessionContext, resolvedNames: ResolvedNames) => string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** CSS variable name for the accent color, e.g. "--color-accent" */
  accentVar: string;

  // ── Context requirements ──
  /** If true, a story must be selected before starting */
  requiresStory: boolean;
  /** If true, a character must be selected */
  requiresCharacter: boolean;
  /** If true, a scene/node must be selected */
  requiresNode: boolean;

  /**
   * Infer the default context from the current view state.
   * Called when the user opens this session type from the command palette.
   * Receives the current story/node IDs from the UI.
   */
  getDefaultContext: (currentView: { storyId?: string; nodeId?: string }) => Partial<SessionContext>;

  /**
   * Build the list of selectable contexts shown in the panel's context picker.
   * For interview: characters. For scene-assistant: scenes. Etc.
   */
  getContextItems: (opts: { storyId?: string }) => Promise<ContextOption[]> | ContextOption[];

  /**
   * How to display the selected context item in the header.
   * e.g. the character name, or the scene title.
   */
  contextItemLabel: (ctx: SessionContext, resolvedNames: ResolvedNames) => string;

  // ── Backend integration ──
  /**
   * Called once when a session is created.
   * Return the backendSessionId if one is created (e.g. interview), or null.
   * Return initial messages to pre-populate (e.g. resuming an existing session).
   */
  initSession: (ctx: SessionContext, params?: { title?: string }) => Promise<{
    backendSessionId?: string;
    messages?: import("../../types").ChatMessage[];
    interviewNotes?: string;
    chronicleSessionId?: string;
    /** When set, the user should be asked Continue/Start Fresh before loading messages. */
    pendingResume?: {
      chronicleSessionId: string;
      messages: import("../../types").ChatMessage[];
      preview: string;
      messageCount: number;
    };
  }>;

  /**
   * Send a message in this session. Returns a streaming Response.
   */
  sendMessage: (
    session: { backendSessionId?: string; context: SessionContext; messages: import("../../types").ChatMessage[] },
    content: string,
    signal?: AbortSignal,
    llmParams?: LLMParams,
  ) => Promise<Response>;

  /** Whether this session type persists messages in the backend (interviews) vs client-only */
  persistsInBackend: boolean;

  /** Whether the context can be changed in the panel header (before first message) */
  allowContextSwitch: boolean;

  /** Default context scope for this mode. If omitted, no scope selector is shown. */
  defaultScope?: ContextScope;
  /** Scopes the user can choose from. Selector only shown if length > 1. */
  allowedScopes?: ContextScope[];
}

/** Resolved display names for context IDs */
export interface ResolvedNames {
  characterName?: string;
  nodeName?: string;
  storyTitle?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, SessionTypeConfig>();

export function registerSessionType(config: SessionTypeConfig) {
  registry.set(config.id, config);
}

export function getSessionType(id: string): SessionTypeConfig | undefined {
  return registry.get(id);
}

export function getAllSessionTypes(): SessionTypeConfig[] {
  return Array.from(registry.values());
}
