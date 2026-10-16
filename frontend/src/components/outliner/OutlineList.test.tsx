import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test/mocks/server";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryStructureTemplate, StructureNode } from "../../types";
import OutlineList from "./OutlineList";

const node = (id: string, over: Partial<StructureNode> = {}, children: StructureNode[] = []) =>
  ({
    id,
    story_id: "s1",
    title: id,
    synopsis: "",
    word_count: 0,
    status: "planned",
    level: 0,
    level_type: "section",
    parent_id: null,
    position: 0,
    children: children.map((c, i) => ({ ...c, parent_id: id, position: i })),
    ...over,
  }) as StructureNode;

const scene = (id: string) => node(id, { level: 1, level_type: "scene" });

const FREEFORM = {
  id: "freeform",
  levels: [
    { name: "Section", plural: "Sections" },
    { name: "Scene", plural: "Scenes" },
  ],
  flat: false,
} as StoryStructureTemplate;

/** The structure calls the Outline makes, as they were sent. */
function serve() {
  const sent: { created: Record<string, unknown>[]; reordered: Record<string, unknown>[][] } = {
    created: [],
    reordered: [],
  };
  server.use(
    http.get("/api/stories/s1/structure", () => HttpResponse.json(useStoryStore.getState().structure)),
    http.post("/api/stories/s1/structure", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.created.push(body);
      return HttpResponse.json({ ...body, id: `new-${sent.created.length}` }, { status: 201 });
    }),
    http.post("/api/stories/s1/structure/reorder", async ({ request }) => {
      sent.reordered.push(((await request.json()) as { operations: Record<string, unknown>[] }).operations);
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch("/api/structure/:id", async ({ request, params }) =>
      HttpResponse.json({ id: params.id, ...((await request.json()) as object) }),
    ),
  );
  return sent;
}

function draw() {
  render(
    <MemoryRouter>
      <OutlineList storyId="s1" />
    </MemoryRouter>,
  );
}

const title = (id: string) =>
  document.querySelector<HTMLInputElement>(`[data-outline-line="${id}"][data-field="title"]`)!;

beforeEach(() => {
  localStorage.clear();
  useStoryStore.setState({
    activeTemplate: FREEFORM,
    structure: [node("S1", {}, [scene("a"), scene("b"), scene("c")])],
  });
});

describe("the Outline's keys", () => {
  it("Enter adds the next line, saved in its place once it has words", async () => {
    const sent = serve();
    draw();
    act(() => title("a").focus());
    fireEvent.keyDown(title("a"), { key: "Enter" });
    const line = await screen.findByPlaceholderText("What happens next…");
    expect(document.activeElement).toBe(line);
    fireEvent.change(line, { target: { value: "The storm breaks" } });
    fireEvent.keyDown(line, { key: "Enter" });
    await waitFor(() => expect(sent.created).toHaveLength(1));
    expect(sent.created[0]).toMatchObject({
      title: "The storm breaks",
      parent_id: "S1",
      position: 1,
      level: 1,
      level_type: "scene",
      status: "planned",
      insert: true,
    });
  });

  it("Shift+Tab makes a planned scene the section that holds the lines after it", async () => {
    const sent = serve();
    draw();
    fireEvent.keyDown(title("b"), { key: "Tab", shiftKey: true });
    await waitFor(() => expect(sent.reordered).toHaveLength(1));
    expect(sent.reordered[0]).toEqual(
      expect.arrayContaining([
        { node_id: "b", parent_id: null, position: 1, level_type: "section" },
        { node_id: "c", parent_id: "b", position: 0 },
      ]),
    );
  });

  it("Tab tucks a section under the one above it", async () => {
    useStoryStore.setState({
      structure: [node("S1", {}, [scene("a")]), node("S2", { position: 1 }, [scene("d")])],
    });
    const sent = serve();
    draw();
    fireEvent.keyDown(title("S2"), { key: "Tab" });
    await waitFor(() => expect(sent.reordered).toHaveLength(1));
    expect(sent.reordered[0]).toEqual(
      expect.arrayContaining([
        { node_id: "S2", parent_id: "S1", position: 1, level_type: "scene" },
        { node_id: "d", parent_id: "S1", position: 2 },
      ]),
    );
  });

  it("says why when the shape forbids a move, and moves nothing", async () => {
    const sent = serve();
    draw();
    fireEvent.keyDown(title("b"), { key: "Tab" });
    expect(await screen.findByText(/A scene is the smallest part/)).toBeTruthy();
    expect(sent.reordered).toHaveLength(0);
  });
});

describe("a line too long for its row", () => {
  it("keeps the whole line for the pointer, and the row's tip for the keyboard", () => {
    const long = "Eleanor monitors the approaching storm and prepares the light for a long night alone";
    useStoryStore.setState({
      structure: [node("S1", {}, [{ ...scene("a"), synopsis: long, word_count: 900 }])],
    });
    draw();
    const what = document.querySelector<HTMLInputElement>('[data-outline-line="a"][data-field="synopsis"]')!;
    expect(what.title).toBe(long);
    expect(what.dataset.clip).toBeDefined();
    expect(title("a").title).toBe("a");
  });
});
