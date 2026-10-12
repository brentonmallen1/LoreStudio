import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Pages from "./Pages";

/** A script measured in pages (doc 25, P5). */
describe("Pages", () => {
  it("says the length, the form and the long scenes", () => {
    render(
      <MemoryRouter>
        <Pages
          storyId="s1"
          format="screenplay"
          then={{
            total: 30,
            form: "short_film",
            target: null,
            by_part: [],
            dialogue_pct: 40,
            long_scenes: [],
            mean_eighths: 9,
          }}
          pages={{
            total: 34,
            form: "short_film",
            target: {
              min: 1,
              max: 40,
              soft_warning_at: 36,
              current: 34,
              pct: 85,
              warning_level: "normal",
              unit: "pages",
            },
            by_part: [
              { id: "a1", title: "Act One", pages: 9.5 },
              { id: "a2", title: "Act Two", pages: 18 },
            ],
            dialogue_pct: 42,
            long_scenes: [{ id: "n1", title: "The Storm", eighths: 27 }],
            mean_eighths: 11,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("34 pages")).toBeTruthy();
    expect(
      screen.getByText(/\(\+4 since then\), about 34 minutes on screen, at a minute a page/),
    ).toBeTruthy();
    expect(screen.getByText(/rule of thumb for a screenplay/)).toBeTruthy();
    expect(screen.getByText(/42% of it is speech/)).toBeTruthy();
    expect(screen.getByText("85% of the 40 pages a short film usually runs to.")).toBeTruthy();
    expect(screen.getByText("Act One about 9.5 · Act Two about 18")).toBeTruthy();
    expect(screen.getByRole("link", { name: "The Storm" }).getAttribute("href")).toBe("/stories/s1/write/n1");
  });
});
