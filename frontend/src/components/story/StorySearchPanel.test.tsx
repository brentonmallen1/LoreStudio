import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test/mocks/server";
import { useStoryStore } from "../../stores/storyStore";
import type { Story } from "../../types";
import StorySearchPanel from "./StorySearchPanel";

beforeEach(() => {
  useStoryStore.setState({ activeStory: { id: "st", title: "The Last Lighthouse" } as Story });
});

describe("replace across the story", () => {
  it("says how many it also replaced in takes that don't count", async () => {
    server.use(
      http.post("/api/stories/:id/search", () =>
        HttpResponse.json({
          matches: [
            {
              node_id: "s1",
              node_title: "Knock at the Door",
              excerpt: "Margaret waited.",
              match_count: 1,
              level_type: "scene",
            },
          ],
        }),
      ),
      http.post("/api/stories/:id/replace", () =>
        HttpResponse.json({ replaced_count: 1, scenes_affected: 1, in_other_takes: 2, node_ids: ["s1"] }),
      ),
    );
    render(<StorySearchPanel storyId="st" onClose={() => {}} onNavigateToNode={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search term"), { target: { value: "Margaret" } });
    await screen.findByText("Knock at the Door");
    fireEvent.click(screen.getByRole("button", { name: "Replace all" }));
    expect((await screen.findByText(/Replaced 1 occurrence/)).textContent?.replace(/\s+/g, " ")).toBe(
      "Replaced 1 occurrence across 1 scene, and 2 in other takes.",
    );
  });
});
