import { describe, expect, it } from "vitest";
import type { Twist, TwistClue } from "../../types";
import { fairPlay, misdirectionLine } from "./fairPlay";

const index = new Map(["a", "b", "c", "d", "e"].map((id, i) => [id, i]));
const clue = (node_id: string, points_to: "truth" | "misdirection", subtlety: TwistClue["subtlety"]) =>
  ({ node_id, points_to, subtlety }) as TwistClue;
const twist = (clues: TwistClue[], reveal: string | null = "e") =>
  ({ clues, revealed_at_node_id: reveal }) as Twist;

describe("fair play", () => {
  it("asks for a plainer clue when every clue is quiet", () => {
    const f = fairPlay(twist([clue("a", "truth", "subtle"), clue("b", "truth", "hidden")]), index);
    expect(f.line).toBe(
      "Two clues point to the truth before the reveal (subtle and hidden). A careful reader could get there; most won't.",
    );
    expect(f.advice).toMatch(/plainer/);
  });

  it("says when nothing points to the truth before the reveal", () => {
    expect(fairPlay(twist([clue("e", "truth", "obvious")]), index).line).toBe(
      "No clue points to the truth before the reveal.",
    );
  });

  it("notices a misdirection left to fade before the reveal", () => {
    expect(
      misdirectionLine(twist([clue("a", "misdirection", "moderate")]), index, (id) => id.toUpperCase()),
    ).toBe("One clue points away, in A. Nothing keeps the false idea alive after A.");
  });
});
