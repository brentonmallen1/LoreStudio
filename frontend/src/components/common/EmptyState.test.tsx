import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EmptyState from "./EmptyState";
import { EMPTY } from "../../lib/emptyStates";

describe("EmptyState", () => {
  it("says what it is, why it helps, how to start, an example and its guide, in that order", () => {
    const onClick = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <EmptyState copy={EMPTY.characters} action={{ label: "Add a character", onClick }} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    const order = [
      "Who is in your story?",
      "Keep the people",
      "When you come back",
      "Add a character",
      "@",
      "Eleanor Vance",
      "How to write people",
    ];
    const at = order.map((t) => text.indexOf(t));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    screen.getByRole("button", { name: "Add a character" }).click();
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "How to write people" }).getAttribute("href")).toBe(
      "/guides/who-are-they",
    );
  });

  it("keeps a narrow one to what it is, how to start and the guide", () => {
    const { container } = render(
      <MemoryRouter>
        <EmptyState copy={EMPTY.characters} size="small" action={{ label: "Open Characters", to: "/x" }} />
      </MemoryRouter>,
    );
    expect(container.textContent).not.toContain("Eleanor Vance");
    expect(container.textContent).not.toContain("When you come back");
    expect(screen.getByRole("link", { name: "Open Characters" }).getAttribute("href")).toBe("/x");
  });
});
