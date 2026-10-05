import type { SeriesSummary } from "../../api/series";
import type { Story } from "../../types";
import { serverTime } from "../serverDate";

export type DashboardSegment =
  { type: "stories"; stories: Story[] } | { type: "series"; series: SeriesSummary; books: Story[] };

/**
 * The dashboard in the order stories were last touched (series doc): a series is one group
 * where its most recently edited book would be, its books inside in series order; the
 * standalone stories between groups stay together in one grid. A series planned before any
 * book of it exists sits where its own last edit would be.
 */
export function dashboardSegments(stories: Story[], series: SeriesSummary[]): DashboardSegment[] {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const seriesOf = new Map<string, SeriesSummary>();
  for (const s of series) for (const b of s.books) seriesOf.set(b.story_id, s);

  const recency = (s: Story) => serverTime(s.updated_at) || 0;
  const empty = series.filter((s) => !s.books.some((b) => byId.has(b.story_id)));
  const ordered = [
    ...stories.map((story) => ({ story, at: recency(story) })),
    ...empty.map((group) => ({ group, at: serverTime(group.updated_at ?? "") || 0 })),
  ].sort((a, b) => b.at - a.at);

  const out: DashboardSegment[] = [];
  const placed = new Set<string>();
  for (const item of ordered) {
    if ("group" in item) {
      out.push({ type: "series", series: item.group, books: [] });
      continue;
    }
    const story = item.story;
    const group = seriesOf.get(story.id);
    if (!group) {
      const last = out[out.length - 1];
      if (last?.type === "stories") last.stories.push(story);
      else out.push({ type: "stories", stories: [story] });
      continue;
    }
    if (placed.has(group.id)) continue;
    placed.add(group.id);
    const books = [...group.books]
      .sort((a, b) => a.position - b.position)
      .map((b) => byId.get(b.story_id))
      .filter((s): s is Story => !!s);
    out.push({ type: "series", series: group, books });
  }
  return out;
}
