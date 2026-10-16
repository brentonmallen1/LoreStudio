import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryStructureTemplate, StructureNode } from "../../types";
import SceneChooser from "./SceneChooser";

const node = (id: string, title: string, children: StructureNode[] = []) =>
  ({
    id,
    title,
    synopsis: "",
    word_count: children.length ? 0 : 200,
    status: "draft",
    position: 0,
    children: children.map((c, i) => ({ ...c, position: i })),
  }) as unknown as StructureNode;

beforeEach(() => {
  useStoryStore.setState({
    activeTemplate: {
      id: "freeform",
      levels: [
        { name: "Chapter", plural: "Chapters" },
        { name: "Scene", plural: "Scenes" },
      ],
      flat: false,
    } as StoryStructureTemplate,
    structure: [
      node("c1", "Chapter 1", [node("a", "Storm Warning")]),
      { ...node("c3", "Chapter 3", [node("g", "The Gap"), node("t", "The Torn Edge")]), position: 1 },
    ],
  });
});

const words = "Eleanor finds the logbook open at the missing week.";

describe("making a scene from Freewrite", () => {
  it("plans one by default, landing after the last scene, and says where before making it", () => {
    const onMake = vi.fn();
    render(<SceneChooser words={words} busy={false} onMake={onMake} onCancel={() => {}} />);
    expect(screen.getByText("New scene in Chapter 3, after “The Torn Edge”")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Eleanor finds the logbook open at",
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan it" }));
    expect(onMake).toHaveBeenCalledWith(
      expect.objectContaining({
        how: "plan",
        title: "Eleanor finds the logbook open at",
        spot: expect.objectContaining({ parentId: "c3", position: 2 }),
      }),
    );
  });

  it("places it where the writer picks, and starts a first draft", () => {
    const onMake = vi.fn();
    render(<SceneChooser words={words} busy={false} onMake={onMake} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Start a scene/));
    fireEvent.change(screen.getByLabelText("Where the new scene goes"), { target: { value: "c3:1" } });
    expect(screen.getByText("New scene in Chapter 3, after “The Gap”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start it" }));
    expect(onMake).toHaveBeenCalledWith(
      expect.objectContaining({
        how: "start",
        spot: expect.objectContaining({ parentId: "c3", position: 1 }),
      }),
    );
  });

  it("keeps the words as an idea in the Outline's tray, with no title or place to choose", () => {
    const onMake = vi.fn();
    render(<SceneChooser words={words} busy={false} onMake={onMake} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Save as an idea/));
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByText("Goes to the Outline's Not placed yet tray.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save the idea" }));
    expect(onMake).toHaveBeenCalledWith({ how: "idea" });
  });

  it("goes back without making anything", () => {
    const onMake = vi.fn();
    const onCancel = vi.fn();
    render(<SceneChooser words={words} busy={false} onMake={onMake} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onMake).not.toHaveBeenCalled();
  });
});
