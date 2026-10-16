import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantResult } from "../../../api/assistantResults";
import { runActions, type Subject } from "../../../lib/ai/sheetActions";
import { useAuthStore } from "../../../stores/authStore";
import type { User } from "../../../types";
import AssistantBand from "./AssistantBand";
import AssistantMenu from "./AssistantMenu";
import { useKeptAnswers } from "./useKeptAnswers";

const kept: AssistantResult = {
  id: "r1",
  subject_type: "location",
  subject_id: "p1",
  feature: "what-exists",
  heading: "Brainstorm what exists",
  data: { questions: ["Which logbook is missing?"] },
  ai_call_log_id: "log1",
  created_at: "2026-10-13T10:00:00Z",
  updated_at: "2026-10-13T10:00:00Z",
};

const server = { rows: [kept] as AssistantResult[] };
const list = vi.fn(() => Promise.resolve([...server.rows]));
const clear = vi.fn((_story: string, id: string) => {
  server.rows = server.rows.filter((r) => r.id !== id);
  return Promise.resolve();
});
vi.mock("../../../api/assistantResults", () => ({
  assistantResultsApi: {
    list: () => list(),
    clear: (story: string, id: string) => clear(story, id),
  },
}));

const subject: Subject = { storyId: "s1", type: "location", id: "p1", name: "The Lighthouse" };

function Sheet() {
  const answers = useKeptAnswers(subject);
  const actions = runActions(subject);
  return (
    <>
      <AssistantMenu name={subject.name} actions={actions} kept={answers} />
      <AssistantBand subject={subject} actions={actions} kept={answers} />
    </>
  );
}

describe("kept Assistant answers on a sheet", () => {
  beforeEach(() => {
    server.rows = [kept];
    list.mockClear();
    useAuthStore.setState({ user: null });
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it("reads the kept answer back after a remount, and Clear removes it", async () => {
    const first = render(<Sheet />);
    await screen.findByText("Which logbook is missing?");
    first.unmount();

    render(<Sheet />);
    await screen.findByText("Which logbook is missing?");
    expect(screen.getByRole("button", { name: /Brainstorm what exists/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(screen.queryByText("Which logbook is missing?")).toBeNull());
    expect(clear).toHaveBeenCalledWith("s1", "r1");
  });

  it("names each action with its line, says which answer is kept, and says how long answers stay", async () => {
    render(<Sheet />);
    await screen.findByText("Which logbook is missing?");
    fireEvent.click(screen.getByRole("button", { name: /^Assistant/ }));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("What would logically exist at this location?");
    expect(items[0].textContent).toContain("Answer kept below");
    expect(screen.getByText(/Answers stay on this page until you clear them or ask again/)).toBeTruthy();
  });

  it("keeps a character's answers from elsewhere in the band, but not Careful's verdicts", async () => {
    const hero: Subject = { storyId: "s1", type: "character", id: "c1", name: "Eleanor" };
    server.rows = [
      {
        ...kept,
        id: "r2",
        subject_type: "character",
        subject_id: "c1",
        feature: "voice-fidelity",
        heading: "Voice Fidelity",
        data: { overall_fidelity: "good", summary: "She sounds like herself." },
      },
      {
        ...kept,
        id: "r3",
        subject_type: "character",
        subject_id: "c1",
        feature: "pronoun-identification",
        heading: "Pronoun Identification",
        data: { judged: [] },
      },
    ];
    function CharacterSheet() {
      const answers = useKeptAnswers(hero);
      const actions = runActions(hero);
      return (
        <>
          <AssistantMenu name={hero.name} actions={actions} kept={answers} />
          <AssistantBand subject={hero} actions={actions} kept={answers} />
        </>
      );
    }
    const first = render(<CharacterSheet />);
    await screen.findByText("She sounds like herself.");
    first.unmount();
    render(<CharacterSheet />);
    await screen.findByText("She sounds like herself.");
    expect(screen.getByText("1 answer kept")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Assistant/ }));
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items.some((t) => t?.includes("Arc Analysis"))).toBe(true);
    expect(items.some((t) => t?.includes("Voice Fidelity") && t.includes("Answer kept below"))).toBe(true);
  });

  it("shows nothing and asks nothing in Writer mode", async () => {
    useAuthStore.setState({ user: { settings: { ui: { mode: "writer" } } } as unknown as User });
    const { container } = render(<Sheet />);
    await act(() => Promise.resolve());
    expect(container.innerHTML).toBe("");
    expect(list).not.toHaveBeenCalled();
  });
});
