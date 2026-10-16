import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantResult } from "../../../api/assistantResults";
import { useAuthStore } from "../../../stores/authStore";
import type { User } from "../../../types";
import PlanGuidance from "../../plan/PlanGuidance";
import { RecapCard } from "../../overview/Recap";
import { useRecap } from "../../overview/useRecap";
import ArcAnalysisBody from "../../characters/ArcAnalysisBody";

const answer = (over: Partial<AssistantResult>): AssistantResult => ({
  id: "r1",
  subject_type: "story",
  subject_id: "s1",
  feature: "session-recap",
  heading: "Session Recap",
  data: { text: "Last time you let the Visitor in." },
  ai_call_log_id: "log1",
  created_at: "2026-10-13T10:00:00Z",
  updated_at: "2026-10-13T10:00:00Z",
  ...over,
});

const server = { rows: [] as AssistantResult[] };
const list = vi.fn((_story: string, type: string, id?: string) =>
  Promise.resolve(server.rows.filter((r) => r.subject_type === type && (!id || r.subject_id === id))),
);
const clear = vi.fn((_story: string, id: string) => {
  server.rows = server.rows.filter((r) => r.id !== id);
  return Promise.resolve();
});
vi.mock("../../../api/assistantResults", () => ({
  assistantResultsApi: {
    list: (story: string, type: string, id?: string) => list(story, type, id),
    clear: (story: string, id: string) => clear(story, id),
  },
}));

const getSnowflakeGuidance = vi.fn();
const recapLastSession = vi.fn();
vi.mock("../../../api/client", () => ({
  api: {
    getSnowflakeGuidance: (...a: unknown[]) => getSnowflakeGuidance(...a),
    recapLastSession: (...a: unknown[]) => recapLastSession(...a),
  },
}));

function Overview() {
  const recap = useRecap("s1");
  return <RecapCard recap={recap} />;
}

describe("kept answers outside a sheet (A7)", () => {
  beforeEach(() => {
    list.mockClear();
    clear.mockClear();
    getSnowflakeGuidance.mockClear();
    recapLastSession.mockClear();
    useAuthStore.setState({ user: null });
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it("shows a Plan step's kept guidance after a remount, without asking again", async () => {
    server.rows = [
      answer({
        feature: "snowflake-guidance:sentence",
        data: { text: "What does she lose if the light goes out?" },
      }),
    ];
    const step = <PlanGuidance storyId="s1" layer="sentence" content="A keeper stays." stepName="Logline" />;
    const first = render(step);
    await screen.findByText("What does she lose if the light goes out?");
    first.unmount();

    render(step);
    await screen.findByText("What does she lose if the light goes out?");
    expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Talk it over/ })).toBeTruthy();
    expect(getSnowflakeGuidance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await screen.findByText("Get guidance on this answer");
    expect(clear).toHaveBeenCalledWith("s1", "r1");
  });

  it("keeps a character's layer on the character", async () => {
    server.rows = [
      answer({
        subject_type: "character",
        subject_id: "c1",
        feature: "snowflake-guidance:character_summary",
        data: { text: "Who does she stay for?" },
      }),
    ];
    render(<PlanGuidance storyId="s1" layer="character_summary" content="Eleanor" characterId="c1" />);
    await screen.findByText("Who does she stay for?");
    expect(list).toHaveBeenCalledWith("s1", "character", "c1");
  });

  it("shows the Overview's kept recap after a remount, without asking again", async () => {
    server.rows = [answer({})];
    const first = render(<Overview />);
    await screen.findByText("Last time you let the Visitor in.");
    first.unmount();

    render(<Overview />);
    await screen.findByText("Last time you let the Visitor in.");
    expect(recapLastSession).not.toHaveBeenCalled();
  });

  it("reads nothing and shows nothing in Writer mode", async () => {
    server.rows = [answer({})];
    useAuthStore.setState({ user: { settings: { ui: { mode: "writer" } } } as unknown as User });
    const { container } = render(<Overview />);
    await act(() => Promise.resolve());
    expect(container.innerHTML).toBe("");
    expect(list).not.toHaveBeenCalled();
  });

  it("lays out a kept Arc Analysis", async () => {
    render(<ArcAnalysisBody data={{ overall_rating: "fair", suggestions: ["Let her choose the light."] }} />);
    await waitFor(() => expect(screen.getByText("Let her choose the light.")).toBeTruthy());
    expect(screen.getByText("Fair")).toBeTruthy();
  });
});
