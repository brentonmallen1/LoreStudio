import { describe, expect, it } from "vitest";
import type { BookStep, PromiseAcross } from "../../types/promises";
import { stepWords, threadAcrossLine, threadBadge, twistAcrossLine } from "./promises";

const across = (over: Partial<PromiseAcross>): PromiseAcross => ({
  element_id: "e",
  from_book: null,
  continues_in: null,
  resolved_in: null,
  revealed_in: null,
  books: [],
  ...over,
});

const step = (over: Partial<BookStep>): BookStep => ({
  position: 0,
  story_id: "s",
  ref_id: "r",
  roles: [],
  toward: 0,
  away: 0,
  reveal: null,
  set_aside: false,
  first: "",
  last: "",
  ...over,
});

describe("promises across books, in words", () => {
  it("says where a thread goes on and came from", () => {
    expect(threadBadge(across({ continues_in: 1 }), "open")).toBe("Continues in Book 2");
    expect(threadBadge(across({ from_book: 0 }), "planned")).toBe("Carried from Book 1");
    expect(threadBadge(across({ from_book: 0 }), "resolved")).toBeNull();
    expect(threadBadge(undefined, "open")).toBeNull();
    const closes = { position: 2, story_id: "s3", node_id: "n", title: "The Return" };
    expect(threadAcrossLine(across({ from_book: 0, resolved_in: closes }))).toBe(
      "Carried from Book 1. Closes in Book 3, in The Return.",
    );
  });

  it("says where a twist is revealed when it is another book", () => {
    const at = { position: 2, story_id: "s3", node_id: "n", title: "The Truth" };
    expect(twistAcrossLine(across({ revealed_in: at }))).toBe("Revealed in Book 3 · The Truth");
    expect(twistAcrossLine(across({ continues_in: 1 }))).toBe(
      "Not revealed in this book · carried into Book 2",
    );
    expect(twistAcrossLine(across({}))).toBeNull();
  });

  it("puts each book's part in a line", () => {
    expect(stepWords(step({ roles: ["opens", "turns"], first: "One", last: "Two" }), "thread")).toBe(
      "opens it, turns it (from One to Two)",
    );
    expect(stepWords(step({}), "thread")).toBe("carried, not in a scene yet");
    expect(stepWords(step({ toward: 2, reveal: "The Truth" }), "twist")).toBe(
      "clues 2 toward the truth; revealed in The Truth",
    );
  });
});
