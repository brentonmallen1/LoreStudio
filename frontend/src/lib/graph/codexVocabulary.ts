/**
 * How the Codex graph reads on screen.
 *
 * Node kinds and edge kinds are stored as short machine words — "present_in", "advances".
 * The author never sees those: this is the one place they become English, so the graph,
 * the node page and the review queue all say the same thing.
 */

export const NODE_LABELS: Record<string, string> = {
  character: "Character",
  scene: "Scene",
  location: "Location",
  thread: "Plot thread",
  twist: "Twist",
  fact: "Fact",
  culture: "Culture",
  system: "World system",
};

/** Deliberately not the AI purple: these are the story's own things, not the model's. */
export const NODE_COLORS: Record<string, string> = {
  character: "var(--color-accent)",
  scene: "var(--color-nlp)",
  location: "var(--segment-chapter)",
  thread: "var(--segment-act)",
  twist: "var(--color-danger)",
  fact: "var(--color-ai)",
  culture: "var(--segment-scene)",
  system: "var(--segment-scene)",
};

export const EDGE_LABELS: Record<string, string> = {
  rel: "related to",
  pov: "point of view",
  present_in: "present in",
  speaks_in: "speaks in",
  at: "set in",
  follows: "followed by",
  links: "links to",
  advances: "advances",
  revealed_in: "revealed in",
  clue_in: "hinted at in",
  knows: "knows",
  established_in: "established in",
};

export function nodeLabel(kind: string): string {
  return NODE_LABELS[kind] ?? kind;
}

export function nodeColor(kind: string): string {
  return NODE_COLORS[kind] ?? "var(--color-text-secondary)";
}

export function edgeLabel(kind: string): string {
  return EDGE_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/** A proposal the author has not answered yet. Drawn dashed, everywhere. */
export function isProposal(source: string): boolean {
  return source === "llm";
}
