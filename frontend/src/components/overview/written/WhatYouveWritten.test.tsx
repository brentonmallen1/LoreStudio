import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test/mocks/server";
import { useStoryStore } from "../../../stores/storyStore";
import type { StoryStructureTemplate, StructureNode } from "../../../types";
import type { WrittenOut } from "../../../types/written";
import WhatYouveWritten from "./WhatYouveWritten";

const scene = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    story_id: "s1",
    parent_id: null,
    title: id,
    synopsis: "",
    word_count: 300,
    status: "draft",
    level: 0,
    level_type: "scene",
    position: 0,
    children: [],
    ...over,
  }) as unknown as StructureNode;

const WRITTEN: WrittenOut = {
  people: [{ id: "c1", name: "Nell", times: 58, scenes: 6, color_slot: 1 }],
  places: [{ id: "l1", name: "Harrow Island", times: 19, scenes: 4, color_slot: 2 }],
  new_names: [
    {
      proposal_id: "name:person:abc",
      kind: "person",
      name: "Margaret",
      times: 4,
      actions: [{ id: "add", label: "Add as a person" }],
      decline: "Not a person",
    },
  ],
  last_scan: "2026-10-16T10:00:00",
  split_offers: [
    {
      node_id: "low",
      title: "Low Water",
      words: 4200,
      jumps: [
        { phrase: "By morning", passage: "By morning the tide" },
        { phrase: "Three days on", passage: "Three days on, Nell" },
      ],
      long_scene_words: 2500,
    },
  ],
  chapters_offers: [],
};

function serve() {
  const sent: { notNow: string[]; declined: string[]; patched: unknown[] } = {
    notNow: [],
    declined: [],
    patched: [],
  };
  server.use(
    http.get("/api/stories/s1/written", () => HttpResponse.json(WRITTEN)),
    http.post("/api/stories/s1/written/not-now", async ({ request }) => {
      sent.notNow.push(((await request.json()) as { key: string }).key);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/stories/s1/proposals/:id/decline", ({ params }) => {
      sent.declined.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("/api/stories/s1/proposals", () =>
      HttpResponse.json({ proposals: [], counts_by_kind: {}, count: 0 }),
    ),
    http.patch("/api/structure/:id", async ({ request, params }) => {
      sent.patched.push({ id: params.id, ...((await request.json()) as object) });
      return HttpResponse.json({ id: params.id });
    }),
  );
  return sent;
}

function draw(discover = true) {
  render(
    <MemoryRouter>
      <WhatYouveWritten storyId="s1" discover={discover} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useStoryStore.setState({
    activeTemplate: {
      id: "flat",
      levels: [{ name: "Scene", plural: "Scenes" }],
      flat: false,
    } as StoryStructureTemplate,
    structure: [
      scene("ferry", { title: "The Ferry", synopsis: "Nell comes back to Harrow." }),
      scene("cottage", { title: "Untitled", position: 1, first_line: "The cottage smelled of paraffin." }),
      scene("low", {
        title: "Low Water",
        position: 2,
        word_count: 4200,
        synopsis: "Nell walks the causeway.",
      }),
    ],
  });
});

describe("What you've written", () => {
  it("shows each scene in a line, its first line marked, and who and where the prose names", async () => {
    serve();
    draw();
    expect(await screen.findByText("Nell")).toBeTruthy();
    expect(screen.getByDisplayValue("Nell comes back to Harrow.")).toBeTruthy();
    expect(screen.getByPlaceholderText("“The cottage smelled of paraffin.”")).toBeTruthy();
    expect(screen.getByText("from the first line")).toBeTruthy();
    expect(screen.getByText("4,200 words")).toBeTruthy();
    expect(screen.getByText("Harrow Island")).toBeTruthy();
    expect(screen.getByText(/turns up 4 times but isn't in your Lorebook/)).toBeTruthy();
  });

  it("offers a split where the time jumps, says its rule, and keeps Not now", async () => {
    const sent = serve();
    draw();
    expect(await screen.findByText(/The time jumps twice, at “By morning” and “Three days on”/)).toBeTruthy();
    expect(screen.getByText(/2,500 words or more/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(sent.notNow).toEqual(["split:low"]));
  });

  it("offers chapters for a part holding many scenes, with its rule", async () => {
    const sent = serve();
    server.use(
      http.get("/api/stories/s1/written", () =>
        HttpResponse.json({
          ...WRITTEN,
          split_offers: [],
          chapters_offers: [
            { part_id: "p1", title: "Section 1", scenes: 9, level: "section", many_scenes: 8 },
          ],
        }),
      ),
    );
    draw();
    expect(await screen.findByText("“Section 1” holds 9 scenes.")).toBeTruthy();
    expect(screen.getByText("LoreStudio offers this when one section holds 8 scenes or more.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make sections" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(sent.notNow).toEqual(["chapters:p1"]));
  });

  it("answers a new name with the Discoveries' no", async () => {
    const sent = serve();
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Not a person" }));
    await waitFor(() => expect(sent.declined).toEqual(["name:person:abc"]));
  });

  it("asks once about a name read as a person and a place, with Neither", async () => {
    const sent = serve();
    server.use(
      http.get("/api/stories/s1/written", () =>
        HttpResponse.json({
          ...WRITTEN,
          new_names: [
            {
              proposal_id: "name:place:dd",
              kind: "place",
              name: "Delia",
              times: 3,
              actions: [
                { id: "person", label: "Add as a person" },
                { id: "place", label: "Add as a place" },
              ],
              decline: "Neither",
            },
          ],
        }),
      ),
    );
    draw();
    expect(await screen.findAllByText("“Delia”")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add as a person" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add as a place" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Neither" }));
    await waitFor(() => expect(sent.declined).toEqual(["name:place:dd"]));
  });

  it("writes an edited line as the scene's line of what happens", async () => {
    const sent = serve();
    draw();
    const line = await screen.findByLabelText(/What happens in “Untitled”/);
    fireEvent.change(line, { target: { value: "Nell opens the cottage." } });
    fireEvent.blur(line);
    await waitFor(() =>
      expect(sent.patched).toEqual([{ id: "cottage", synopsis: "Nell opens the cottage." }]),
    );
  });

  it("is a section to open for a story that is planned", async () => {
    serve();
    draw(false);
    expect(screen.queryByText("Your story so far")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "What you've written" }));
    expect(await screen.findByText("Your story so far")).toBeTruthy();
  });
});
