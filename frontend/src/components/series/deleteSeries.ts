/** What a series' books are, in a sentence: "This series has 3 books: A, B and C." */
export function booksSentence(titles: string[]): string {
  if (titles.length === 0) return "This series has no books yet. Only the series and its plan go.";
  const named = titles.length > 4 ? [...titles.slice(0, 3), `${titles.length - 3} more`] : titles;
  const list =
    named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return titles.length === 1
    ? `This series has one book: ${list}.`
    : `This series has ${titles.length} books: ${list}.`;
}

/** The delete button's words, which follow the choice. */
export function deleteLabel(books: "keep" | "delete", count: number): string {
  if (count === 0) return "Delete the series";
  if (books === "keep")
    return count === 1 ? "Delete the series, keep the book" : "Delete the series, keep the books";
  return count === 1 ? "Delete the series and its book" : `Delete the series and its ${count} books`;
}
