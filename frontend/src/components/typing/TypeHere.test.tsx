import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useTypingStore } from "../../stores/typingStore";
import TypeHere from "./TypeHere";

/** What you can type here, in the status corner's card (doc 26, P3). */
describe("TypeHere", () => {
  beforeEach(() =>
    useTypingStore.setState({
      used: new Set(["line", "mention", "place", "slash", "note", "todo", "image"]),
    }),
  );

  it("puts the helper for this spot first, ticks the used ones and links the guide", () => {
    render(
      <MemoryRouter>
        <TypeHere format="prose" contexts={["anywhere", "after-quote"]} />
      </MemoryRouter>,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Who said a quote");
    expect(rows[0].getAttribute("title")).toMatch(/closing quote/);
    // Six rows: the unused one for this spot, then the used ones, ticked; the rest are in the guide.
    expect(rows).toHaveLength(6);
    expect(screen.getAllByLabelText("Used")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "All of them →" }).getAttribute("href")).toBe("/guides/typing");
  });
});
