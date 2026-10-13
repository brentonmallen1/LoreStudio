import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useStoryStore } from "../../stores/storyStore";
import { markUsed } from "../../stores/typingStore";
import type { StructureNode } from "../../types";
import LessonCard from "./LessonCard";
import { lessonOf, type Lesson } from "../../lib/typing/lesson";

/** A tutorial scene's lesson card (doc 26, P6). */
const LESSON: Lesson = {
  text: "Type `^` and choose who speaks, or press {{key:attributeDialogue}}.",
  practice: [
    { id: "line", task: "Give Margaret a line" },
    { id: "tag", task: "Say who said a quote" },
  ],
  number: 3,
  of: 9,
  topic: "Dialogue",
};

const scene = (id: string, title: string, position: number) =>
  ({
    id,
    title,
    story_id: "s1",
    level: 1,
    level_type: "scene",
    position,
    children: [],
  }) as unknown as StructureNode;

const NODE = { ...scene("n3", "Giving someone a line", 0), metadata_: { lesson: LESSON } } as StructureNode;

function show() {
  return render(
    <MemoryRouter>
      <LessonCard node={NODE} lesson={LESSON} />
    </MemoryRouter>,
  );
}

describe("LessonCard", () => {
  beforeEach(() => {
    localStorage.clear();
    useStoryStore.setState({
      structure: [
        {
          ...scene("sec", "3. Dialogue", 0),
          level: 0,
          level_type: "section",
          children: [NODE, scene("n4", "Notes in the margin", 1)],
        } as StructureNode,
      ],
      activeTemplate: null,
    });
  });

  it("reads the lesson from the scene", () => {
    expect(lessonOf(NODE)).toBe(LESSON);
    expect(lessonOf(scene("x", "Plain", 0))).toBeNull();
  });

  it("says which lesson it is, shows keys, and leads to the next", () => {
    show();
    expect(screen.getByText("Lesson 3 of 9 · Dialogue")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Giving someone a line" })).toBeTruthy();
    expect(screen.getAllByText("^").some((el) => el.tagName === "KBD")).toBe(true);
    const card = screen.getByRole("region", { name: "Lesson" }).textContent;
    expect(card).toMatch(/or press \S+\./);
    expect(card).not.toContain("{{key");
    expect(screen.getByRole("link", { name: "Next: Notes in the margin →" }).getAttribute("href")).toBe(
      "/stories/s1/write/n4",
    );
  });

  it("ticks what is tried and keeps it for the scene", () => {
    const { unmount } = show();
    expect(screen.getByText("0 of 2 tried")).toBeTruthy();
    act(() => markUsed("line"));
    expect(screen.getByText("1 of 2 tried")).toBeTruthy();
    unmount();
    show();
    expect(screen.getByText("1 of 2 tried")).toBeTruthy();
  });

  it("folds away to a line, and stays folded for the story", () => {
    const { unmount } = show();
    fireEvent.click(screen.getByRole("button", { name: "Fold away" }));
    expect(screen.queryByRole("region", { name: "Lesson" })).toBeNull();
    unmount();
    show();
    expect(screen.getByRole("button", { expanded: false }).textContent).toContain("Giving someone a line");
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("region", { name: "Lesson" })).toBeTruthy();
  });
});
