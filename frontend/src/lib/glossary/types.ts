/**
 * One entry of the glossary (doc 30 D1). The glossary guide and every `Term` popover read
 * the same entries, so a definition is written once.
 */
export interface GlossaryEntry {
  /** The anchor in the glossary guide (`/guides/glossary#logline`) and `Term`'s `id`. */
  id: string;
  /** The word as a heading: "Logline", "Point of view (POV)". */
  term: string;
  /** Plain words first. May hold `**bold**`, `` `code` `` and `{{key:id}}`. */
  definition: string;
  /** From The Last Lighthouse, where there is one that fits. */
  example?: string;
  alsoCalled?: string[];
  /** Only in Studio: Writer mode shows no AI at all, the glossary included. */
  studio?: boolean;
}

export interface GlossaryGroup {
  /** `<!-- terms:<id> -->` in glossary.md draws this group there. */
  id: string;
  entries: readonly GlossaryEntry[];
}
