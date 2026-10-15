import { describe, expect, it } from "vitest";
import { booksSentence, deleteLabel } from "./deleteSeries";

describe("deleting a series", () => {
  it("names the books in a sentence, and shortens a long list", () => {
    expect(booksSentence([])).toMatch(/no books yet/);
    expect(booksSentence(["The Last Lighthouse"])).toBe("This series has one book: The Last Lighthouse.");
    expect(booksSentence(["A", "B", "C"])).toBe("This series has 3 books: A, B and C.");
    expect(booksSentence(["A", "B", "C", "D", "E", "F"])).toBe(
      "This series has 6 books: A, B, C and 3 more.",
    );
  });

  it("says on the button what the choice does", () => {
    expect(deleteLabel("keep", 3)).toBe("Delete the series, keep the books");
    expect(deleteLabel("delete", 3)).toBe("Delete the series and its 3 books");
    expect(deleteLabel("delete", 1)).toBe("Delete the series and its book");
    expect(deleteLabel("keep", 0)).toBe("Delete the series");
  });
});
