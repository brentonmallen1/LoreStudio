/**
 * Where each line sits in the Dialogue view, read like a conversation: the side flips each
 * time the speaker changes, so two people trade sides line for line and a third takes the
 * side opposite whoever spoke before them. A run of lines by one speaker stays on one side
 * and is drawn as a group, the name on its first line only. A line with no speaker is centred
 * and changes nothing: the next speaker is compared with the last one who had a name.
 */
export type DialogueSide = "left" | "right" | "centre";

export interface PlacedLine {
  side: DialogueSide;
  /** The first line of a run by its speaker (or a line with no speaker): it shows the name. */
  runStart: boolean;
}

const norm = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

export function assignSides(speakers: (string | null | undefined)[]): PlacedLine[] {
  let side: "left" | "right" = "left";
  let last = "";
  // A centred line between two lines by one speaker breaks the run: the name shows again.
  let broken = true;
  return speakers.map((speaker) => {
    const who = norm(speaker);
    if (!who) {
      broken = true;
      return { side: "centre", runStart: true };
    }
    if (last && who !== last) side = side === "left" ? "right" : "left";
    const runStart = broken || who !== last;
    last = who;
    broken = false;
    return { side, runStart };
  });
}
