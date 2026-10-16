import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { IDENTITY_SECTIONS } from "./identitySections";
import {
  Compass,
  Foundation,
  Form,
  Substance,
  Summaries,
  Voice,
  type IdentityForm,
} from "./StoryIdentitySections";

vi.mock("./StorySummaryPanel", () => ({ default: () => null }));
vi.mock("../analysis/PerspectiveSummaryPanel", () => ({ default: () => null }));
vi.mock("./StoryIdentityBits", async (orig) => ({
  ...(await orig<typeof import("./StoryIdentityBits")>()),
  SeriesCard: () => null,
}));
vi.mock("../tropes/TropesInPlay", () => ({ default: () => null }));
vi.mock("./BeatSheetSelector", () => ({ default: () => null }));

const form: IdentityForm = {
  storyId: "s1",
  fields: {
    logline: "",
    author_name: "",
    genre: "",
    tone: "",
    intended_length: "",
    story_format: "prose",
    narrative_perspective: "",
    pov_character_id: "",
    themes: [],
    central_conflict: "",
    target_audience: "",
    narrative_intent: "",
    premise: "",
    working_style: "",
  },
  update: () => {},
  collapsed: {},
  toggle: () => {},
};

describe("Story identity's sections", () => {
  it("lists six sections for the rail, and each group's heading carries its id", () => {
    expect(IDENTITY_SECTIONS.map((s) => s.text)).toEqual([
      "Foundation",
      "Voice",
      "Form",
      "Substance",
      "Compass",
      "Summaries",
    ]);
    render(
      <MemoryRouter>
        <Foundation {...form} />
        <Voice {...form} characters={[]} onPovCharacter={() => {}} />
        <Form {...form} beatSheetId={null} onBeatSheet={() => {}} onInjectBeatSheet={() => {}} />
        <Substance {...form} />
        <Compass {...form} goals={[]} />
        <Summaries storyId="s1" />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.id)).toEqual(IDENTITY_SECTIONS.map((s) => s.id));
  });
});
