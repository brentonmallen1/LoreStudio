/**
 * Relationship colours, on the palette (doc 17). Three views kept their own copy of a hex
 * table that ignored the theme and the contrast gate; these are tokens, so every theme and
 * dark mode get colours its contrast test has checked. Slots are ink (3:1): as text, mix
 * them toward body text with `relationshipInk`.
 */
const TYPE: Record<string, string> = {
  family: "var(--cat-3)",
  romantic: "var(--cat-6)",
  ally: "var(--cat-1)",
  rival: "var(--color-warning)",
  enemy: "var(--color-danger)",
  mentor: "var(--cat-4)",
  confidant: "var(--color-success)",
  authority: "var(--cat-5)",
  foil: "var(--segment-chapter)",
  protector: "var(--cat-7)",
  "former ally": "var(--cat-8)",
  acquaintance: "var(--color-text-subtle)",
};

const PURPOSE: Record<string, string> = {
  "conflict-driver": "var(--color-danger)",
  ally: "var(--cat-1)",
  foil: "var(--segment-chapter)",
  "growth-catalyst": "var(--color-success)",
  "emotional-anchor": "var(--cat-6)",
  "twist-setup": "var(--cat-4)",
  "comic-relief": "var(--color-warning)",
  "exposition-vehicle": "var(--cat-5)",
  obstacle: "var(--cat-2)",
  mirror: "var(--cat-1)",
  "wisdom-source": "var(--cat-7)",
  "past-connection": "var(--cat-8)",
  "structure-provider": "var(--segment-section)",
};

const NONE = "var(--color-text-subtle)";

export function relationshipTypeColor(type: string): string {
  return TYPE[type.toLowerCase()] ?? NONE;
}

export function relationshipPurposeColor(purpose: string): string {
  return PURPOSE[purpose] ?? NONE;
}

/** A colour as label text: mixed toward body text so it reads at AA on any ground. */
export function relationshipInk(color: string): string {
  return `color-mix(in srgb, ${color} 55%, var(--color-text))`;
}

/** The same colour at a percentage over transparent, for a pill's tint or border. */
export function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
