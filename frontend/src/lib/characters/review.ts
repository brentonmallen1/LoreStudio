/**
 * The review step's reading of a review (doc 20 P3): grouped by scene in reading order, what
 * starts ticked, and where the changed words are, so the sentence can mark them.
 */
import type { Review, ReviewItem } from "../../api/characterReview";

export interface SceneGroup {
  nodeId: string;
  title: string;
  items: ReviewItem[];
}

/** The review's sentences under their scenes, in reading order (the server sends scenes so). */
export function byScene(review: Review): SceneGroup[] {
  return review.scenes
    .map((s) => ({
      nodeId: s.node_id,
      title: s.title,
      items: review.items.filter((i) => i.node_id === s.node_id),
    }))
    .filter((g) => g.items.length > 0);
}

/** Sure ones start ticked; unsure ones and gendered words (which have no rewrite) do not. */
export function initiallyTicked(items: ReviewItem[]): Set<string> {
  return new Set(items.filter((i) => i.sure && i.edits.length > 0).map((i) => i.id));
}

/** The proposed sentence as pieces, the changed words marked. */
export function marked(item: ReviewItem): { text: string; changed: boolean }[] {
  const pieces: { text: string; changed: boolean }[] = [];
  let at = item.sent_start;
  for (const e of [...item.edits].sort((a, b) => a.start - b.start)) {
    if (e.start > at)
      pieces.push({
        text: item.before.slice(at - item.sent_start, e.start - item.sent_start),
        changed: false,
      });
    pieces.push({ text: e.text, changed: true });
    at = e.end;
  }
  if (at < item.sent_end) pieces.push({ text: item.before.slice(at - item.sent_start), changed: false });
  return pieces;
}

/** "she/her → they/them and the name Nell Vance", for the title and the version it saves. */
export function describeChange(change: { pronouns?: [string, string]; name?: [string, string] }): string {
  return [
    change.pronouns ? `${change.pronouns[0] || "no pronouns"} → ${change.pronouns[1]}` : "",
    change.name ? `${change.name[0]} → ${change.name[1]}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** What Quick will miss, in the review's ⓘ and the guide (P3). */
export const QUICK_MISSES = [
  "Two people with the same old pronouns in one scene, where a pronoun isn't next to the right name: Quick marks these unsure rather than guess.",
  "A pronoun whose person was named paragraphs earlier, or a scene that opens on a pronoun.",
  "Gendered words (the woman, his sister, Mrs Holt, ma'am): listed for you to change, with no rewrite proposed, because there is no right replacement to compute.",
  "Other people talking about them in dialogue, letters or quoted text: listed as unsure.",
  "Singular or plural “they” when moving away from they/them: a “they” with no name before it is unsure.",
  "Long sentences the small language model parses wrongly, a verb far from its subject, the second verb in “she laughed and walks”.",
  "Pronoun sets other than she, he, they, xe, ze and it; “any pronouns” and “name only” make no proposals.",
];
