import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../../test/mocks/server";
import CreateStoryDialog from "./CreateStoryDialog";

const FREEFORM = {
  id: "freeform",
  name: "Freeform",
  description: "",
  levels: [
    { name: "Section", plural: "Sections" },
    { name: "Scene", plural: "Scenes" },
  ],
  is_system: true,
  user_id: null,
  starter_outline: ["Section 1"],
  flat: false,
  format: "",
};

function Where() {
  const at = useLocation();
  return <p data-testid="at">{at.pathname + at.search}</p>;
}

/** New Story in plain words (doc 29 P1): the story keeps how its writer works, and opens by it. */
async function setup() {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.get("/api/templates/structures", () => HttpResponse.json([FREEFORM])),
    http.get("/api/stories", () => HttpResponse.json([])),
    http.post("/api/stories", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.push(body);
      return HttpResponse.json({ id: "new-1", ...body, start_node_id: "scene-1" }, { status: 201 });
    }),
  );
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<CreateStoryDialog onClose={() => {}} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("What's it called?"), { target: { value: "Salt" } });
  await screen.findByText("Start with an outline");
  return sent;
}

describe("New Story", () => {
  it("asks how the writer likes to work, and opens a planner's story in the Outline", async () => {
    const sent = await setup();
    fireEvent.click(screen.getByLabelText(/I like to plan first/));
    fireEvent.click(screen.getByRole("button", { name: "Start planning" }));
    await waitFor(() => expect(screen.getByTestId("at").textContent).toBe("/stories/new-1/outline"));
    expect(sent[0]).toMatchObject({ title: "Salt", working_style: "plan", story_format: "prose" });
  });

  it("opens a discovery writer's story in its first scene", async () => {
    const sent = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    await waitFor(() =>
      expect(screen.getByTestId("at").textContent).toBe("/stories/new-1/write?node=scene-1"),
    );
    expect(sent[0]).toMatchObject({ working_style: "discover" });
  });

  it("offers the First story guide as one line, and starts there when chosen", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Use My first story" }));
    fireEvent.click(screen.getByRole("button", { name: "Start the guide" }));
    await waitFor(() => expect(screen.getByTestId("at").textContent).toBe("/stories/new-1/first-story"));
  });

  it("offers the guide for prose only", async () => {
    await setup();
    fireEvent.click(screen.getByLabelText("A screenplay"));
    expect(screen.queryByRole("button", { name: "Use My first story" })).toBeNull();
  });
});
