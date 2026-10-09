/**
 * A scene's key events as steps (doc 24, canvas 8e). They are kept as one text field, the way
 * authors and the seed wrote them ("Knock at the door; Eleanor's hesitation; …") or one per
 * line; the sheet shows and edits them a step at a time and writes them back one per line.
 */

/** "a; b\nc" → ["a", "b", "c"]: split on line breaks and semicolons, blanks dropped. */
export function splitSteps(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The steps back as text, one per line, blanks dropped. */
export function joinSteps(steps: string[]): string {
  return steps
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}
