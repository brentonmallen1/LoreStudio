import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { flatRoutes } from "../routes";

/**
 * Writer mode renders no AI affordance at all (CLAUDE.md).
 *
 * The promise was being broken quietly. The character sheet showed an Interview button in
 * writer mode; pressing it did nothing useful, because the feature is not there. A missed
 * guard is invisible until someone switches modes and finds a dead control, so this test
 * looks for the guard rather than waiting for the report.
 *
 * Two halves. Reachability: only components writer mode can actually open are checked —
 * a page behind `ModeGate` is already gated, and demanding a second guard there would be
 * noise. Signal: a component is an AI surface when it streams from a model, opens the AI
 * panel, or shows what was sent to one. Icons are not the signal; `Orbit` is also used
 * for deterministic NLP reports, which stay in both modes on purpose.
 */

/** What only an AI surface does. */
const AI_MARKERS = [
  "useLLMStream",
  "useLLMTransparency",
  "useLLMContextSources",
  "LLMTransparencyTrigger",
  "useAIStore",
];

/** Any of the ways a component can ask whether AI belongs here. */
const GUARDS = ["AIOnly", "useAIAvailable", "getAIAvailable", "useMode", "getMode"];

/**
 * Rendered inside the AI panel or a transparency modal, neither of which opens in writer
 * mode. Gating them again would be noise; gating them wrongly would hide them in studio.
 */
const INSIDE_THE_PANEL = ["src/components/ai/", "src/components/llm/"];

/** The story routes and sections open in writer mode (lib/routes.ts), as their components. */
const WRITER_ENTRY_POINTS = [
  // The prose itself (/write/:nodeId): its panels open from the editor, not from a route.
  "src/pages/WriteNodePage.tsx",
  "src/pages/StoryOverviewPage.tsx",
  "src/components/firstStory/FirstStoryPage.tsx",
  "src/pages/MediaPage.tsx",
  "src/pages/FindingsPage.tsx",
  "src/pages/NumbersPage.tsx",
  "src/pages/ProposalsPage.tsx",
  "src/pages/ChroniclePage.tsx",
  "src/components/chronicle/versions/VersionsSection.tsx",
  "src/components/story/StoryboardView.tsx",
  "src/components/story/SummaryOverviewView.tsx",
  "src/pages/ManuscriptPage.tsx",
  "src/components/story/StoryIdentityPanel.tsx",
  "src/components/lorebook/sections/CharactersSection.tsx",
  "src/components/lorebook/sections/PlacesSection.tsx",
  "src/components/lorebook/sections/WorldSections.tsx",
  "src/components/lorebook/sections/HistorySection.tsx",
  "src/components/lorebook/sections/ConnectionsSection.tsx",
  "src/components/lorebook/sections/SeriesSection.tsx",
  "src/components/promises/TapestryPage.tsx",
  "src/components/promises/ThreadsSection.tsx",
  "src/components/promises/TwistsSection.tsx",
  "src/components/promises/SetupsSection.tsx",
  "src/components/promises/ReaderSection.tsx",
  "src/components/compendium/CompendiumPanel.tsx",
  "src/components/compendium/CompendiumIndex.tsx",
  "src/components/notes/NotesBoard.tsx",
  "src/components/plan/PlanPage.tsx",
  "src/components/freewrite/FreewritePage.tsx",
];

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

/** Every file writer mode can reach, by following relative imports from its pages. */
function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const root = resolve(".");
  function walk(file: string | null) {
    if (!file || seen.has(file)) return;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      return;
    }
    for (const m of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) walk(resolveImport(file, m[1]));
    for (const m of source.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g)) walk(resolveImport(file, m[1]));
  }
  entries.forEach((e) => walk(resolve(e)));
  return new Set([...seen].map((f) => f.slice(root.length + 1).replace(/\\/g, "/")));
}

describe("writer mode renders no AI affordance", () => {
  const files = reachable(WRITER_ENTRY_POINTS);

  it("every entry point resolves", () => {
    for (const entry of WRITER_ENTRY_POINTS) {
      expect(existsSync(entry), `${entry} — update this list when a route moves`).toBe(true);
    }
    expect(files.size).toBeGreaterThan(50);
  });

  it("every AI surface writer mode can reach consults the mode", () => {
    const ungated: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      if (INSIDE_THE_PANEL.some((prefix) => file.startsWith(prefix))) continue;
      const source = readFileSync(file, "utf8");
      const markers = AI_MARKERS.filter((m) => source.includes(m));
      if (markers.length > 0 && !GUARDS.some((guard) => source.includes(guard))) {
        ungated.push(`${file} (${markers.join(", ")})`);
      }
    }
    expect(ungated).toEqual([]);
  });
});

describe("the story routes this test walks", () => {
  it("covers every route and section open in writer mode", () => {
    // If a page or section becomes available in writer mode, its component belongs above.
    const writer = flatRoutes("writer")
      .filter((e) => !e.ai)
      .map((e) => e.key)
      .sort();
    expect(writer).toEqual([
      "chronicle",
      "chronicle.activity",
      "chronicle.changes",
      "chronicle.versions",
      "compendium",
      "compendium.diagrams",
      "compendium.everything",
      "compendium.images",
      "compendium.notes",
      "compendium.research",
      "findings",
      "first-story",
      "freewrite",
      "lorebook",
      "lorebook.calendars",
      "lorebook.characters",
      "lorebook.connections",
      "lorebook.cultures",
      "lorebook.history",
      "lorebook.identity",
      "lorebook.places",
      "lorebook.series",
      "lorebook.systems",
      "lorebook.travel",
      "manuscript",
      "numbers",
      "overview",
      "plan",
      "promises",
      "promises.reader",
      "promises.setups",
      "promises.tapestry",
      "promises.threads",
      "promises.twists",
      "proposals",
      "storyboard",
      "summaries",
      "write",
    ]);
  });
});
