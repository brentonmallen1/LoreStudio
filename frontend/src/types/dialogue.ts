/* How a line of dialogue was attributed, and how it is heard. Kept out of index.ts (size budget). */

/** "cue": a screenplay's cue named the speaker (doc 25, P4). */
export type AttributionMethod =
  "explicit" | "inferred" | "alternating" | "manual" | "unattributed" | "pov_default" | "cue";

/** A script's cue can say V.O. ("voice_over") or O.S. ("off_screen"): speech to every count. */
export type DialogueType = "speech" | "thought" | "voice_over" | "off_screen";
