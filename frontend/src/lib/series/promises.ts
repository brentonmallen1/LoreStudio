import type { BookStep, PromiseAcross } from "../../types/promises";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import { roleLabel } from "../threads/roles";

/**
 * A thread or twist that runs across the books of a series, in words (series doc, v1.5): the
 * badge and status lines of its sheet, and each book's part in the Across the series fold.
 * Every line comes from the server's reading of the books (GET /stories/{id}/promises).
 */

/** The badge a thread shows in place of its status, when another book matters more. */
export function threadBadge(a: PromiseAcross | undefined, status: string): string | null {
  if (!a) return null;
  if (a.continues_in !== null) return `Continues in ${bookLabel(a.continues_in)}`;
  if (a.from_book !== null && (status === "planned" || status === "open"))
    return `Carried from ${bookLabel(a.from_book)}`;
  return null;
}

/** "Carried from Book 1. Closes in Book 3, in The Return." */
export function threadAcrossLine(a: PromiseAcross | undefined): string {
  if (!a) return "";
  const parts: string[] = [];
  if (a.from_book !== null) parts.push(`Carried from ${bookLabel(a.from_book)}.`);
  if (a.resolved_in) parts.push(`Closes in ${bookLabel(a.resolved_in.position)}, in ${a.resolved_in.title}.`);
  else if (a.continues_in !== null) parts.push(`Continues in ${bookLabel(a.continues_in)}.`);
  return parts.join(" ");
}

/** The twist's presence line, when its reveal is in another book or still to come in one. */
export function twistAcrossLine(a: PromiseAcross | undefined): string | null {
  if (!a) return null;
  if (a.revealed_in) return `Revealed in ${bookLabel(a.revealed_in.position)} · ${a.revealed_in.title}`;
  if (a.continues_in !== null) return `Not revealed in this book · carried into ${bookLabel(a.continues_in)}`;
  return null;
}

/** What one book does with it: "opens it in Margaret's Visit, then turns it". */
export function stepWords(step: BookStep, kind: "thread" | "twist"): string {
  if (kind === "twist") {
    const clues = [
      step.toward ? `${step.toward} toward the truth` : "",
      step.away ? `${step.away} away from it` : "",
    ].filter(Boolean);
    const said = clues.length ? `clues ${clues.join(", ")}` : "";
    const reveal = step.reveal ? `revealed in ${step.reveal}` : "";
    return [said, reveal].filter(Boolean).join("; ") || "in this book, no clue yet";
  }
  if (step.set_aside) return "set aside";
  if (step.roles.length === 0) return "carried, not in a scene yet";
  const words = [...new Set(step.roles)].map((r) => roleLabel(r));
  const where = step.first === step.last ? `in ${step.first}` : `from ${step.first} to ${step.last}`;
  return `${words.join(", ")} (${where})`;
}

/** "Book 3": a book of the open series by its id, for "Bring into Book 3". */
export function carryBook(storyId: string): string {
  const book = useSeriesStore.getState().series?.books.find((b) => b.story_id === storyId);
  return book ? bookLabel(book.position) : "the next book";
}
