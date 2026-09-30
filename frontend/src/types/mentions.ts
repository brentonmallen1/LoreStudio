/** Something the author @-mentioned in a chat, to bring it into that conversation's context (doc 11 P6). */
export type MentionKind = "character" | "location" | "scene" | "thread";

export interface MentionedRef {
  kind: MentionKind;
  id: string;
  /** For the chip; the server looks the thing up by kind and id. */
  label: string;
}

/** What crosses the wire. */
export function toWire(refs: MentionedRef[] | undefined): { kind: MentionKind; id: string }[] {
  return (refs ?? []).map(({ kind, id }) => ({ kind, id }));
}
