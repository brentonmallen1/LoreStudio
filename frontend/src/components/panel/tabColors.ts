import type { EntityKind } from "../../types/panel";

/**
 * A colour per kind of thing, until phase 2 gives each entity its own palette slot.
 * Tokens only: the themes decide what these are.
 */
export const KIND_COLOR: Record<EntityKind, string> = {
  character: "var(--color-accent)",
  location: "var(--color-nlp)",
  thread: "var(--color-editorial)",
  twist: "var(--twist-accent)",
  compendium: "var(--color-text-subtle)",
};

export const KIND_LABEL: Record<EntityKind, string> = {
  character: "Character",
  location: "Place",
  thread: "Plot thread",
  twist: "Twist",
  compendium: "Compendium",
};
