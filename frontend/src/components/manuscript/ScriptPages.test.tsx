import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScriptLayout } from "../../types";
import ScriptPages from "./ScriptPages";
import { pagesSummary } from "./useScriptPreview";

/** The preview draws the server's layout line for line (doc 25, P3): what you see exports. */
const LAYOUT: ScriptLayout = {
  width_pt: 612,
  height_pt: 792,
  page_count: 1,
  pages: [
    [{ top: 264, left: 0, text: "THE LAST LIGHTHOUSE", kind: "centre" }],
    [
      { top: 72, left: 108, text: "INT. KEEPER'S COTTAGE - NIGHT", kind: "bold" },
      { top: 96, left: 266.4, text: "ELEANOR", kind: "" },
    ],
  ],
};

describe("ScriptPages", () => {
  it("places each line where the PDF prints it, a point a third bigger in CSS pixels", () => {
    render(<ScriptPages layout={LAYOUT} />);
    expect(screen.getByRole("img", { name: "Title page" })).toBeTruthy();
    const cue = screen.getByText("ELEANOR");
    expect(cue.style.top).toBe("128px");
    expect(parseFloat(cue.style.left)).toBeCloseTo(355.2);
    expect(screen.getByRole("img", { name: "Page 1" }).textContent).toContain(
      "INT. KEEPER'S COTTAGE - NIGHT",
    );
  });

  it("counts pages as minutes on screen, and says so", () => {
    expect(pagesSummary(1)).toBe("1 page · about a minute on screen, at a minute a page");
    expect(pagesSummary(12)).toBe("12 pages · about 12 minutes on screen, at a minute a page");
    expect(pagesSummary(12, "stage_play")).toBe("12 pages · about 12 minutes on stage, at a minute a page");
  });
});
