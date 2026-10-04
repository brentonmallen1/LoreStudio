import type { SeriesSummary } from "../../api/series";
import type { Story } from "../../types";
import { serverTime } from "../serverDate";

export type DashboardSegment =
  { type: "stories"; stories: Story[] } | { type: "series"; series: SeriesSummary; books: Story[] };

/**
 * The dashboard in the order stories were last touched (series doc): a series is one group
 * where its most recently edited book would be, its books inside in series order; the
 * standalone stories between groups stay together in one grid.
 */
export function dashboardSegments(stories: Story[], series: SeriesSummary[]): DashboardSegment[] {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const seriesOf = new Map<string, SeriesSummary>();
  for (const s of series) for (const b of s.books) seriesOf.set(b.story_id, s);

  const recency = (s: Story) => serverTime(s.updated_at) || 0;
  const ordered = [...stories].sort((a, b) => recency(b) - recency(a));

  const out: DashboardSegment[] = [];
  const placed = new Set<string>();
  for (const story of ordered) {
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
