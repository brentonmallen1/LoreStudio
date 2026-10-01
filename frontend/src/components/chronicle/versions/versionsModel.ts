/**
 * Pure helpers for the Chronicle's Versions section: date and delta formatting, the
 * grouping of auto backups under the manual snapshot they were taken against, and the
 * option lists for the backup settings dialog.
 */
import { parseServerDate, serverTime } from "../../../lib/serverDate";
import type { SnapshotDeltaSummary, StorySnapshot } from "../../../types";

export function formatAbsoluteDate(iso: string): string {
  return parseServerDate(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "+1,200", "-40", or "" for no change. */
export function formatDelta(n: number): string {
  if (n === 0) return "";
  return n > 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? "s" : ""}`;
}

/** The changelog of a snapshot as short phrases, word count first. Empty when nothing changed. */
export function deltaSummaryParts(d: SnapshotDeltaSummary): string[] {
  const parts: string[] = [];
  if (d.scenes_added > 0) parts.push(`+${plural(d.scenes_added, "scene")}`);
  if (d.scenes_removed > 0) parts.push(`-${plural(d.scenes_removed, "scene")}`);
  if (d.scenes_modified > 0) parts.push(`${plural(d.scenes_modified, "scene")} modified`);
  if (d.characters_added > 0) parts.push(`+${plural(d.characters_added, "character")}`);
  if (d.characters_modified > 0) parts.push(`${plural(d.characters_modified, "character")} modified`);
  if (d.threads_added > 0) parts.push(`+${plural(d.threads_added, "thread")}`);
  const wc = formatDelta(d.word_count_delta);
  if (wc) parts.unshift(`${wc} words`);
  return parts;
}

/** Every non-zero numeric field of a delta, as `[label, "+n" | n]` for the expanded changelog. */
export function deltaDetailEntries(d: SnapshotDeltaSummary): [string, string][] {
  return Object.entries(d).flatMap(([k, v]) =>
    typeof v === "number" && v !== 0
      ? [[k.replace(/_/g, " "), v > 0 ? `+${v}` : `${v}`] as [string, string]]
      : [],
  );
}

/** "3 snapshots · 1 auto backup" — the auto part only when there are any. */
export function versionsSubtitle(snapshots: StorySnapshot[]): string {
  const snapshotCount = snapshots.filter((s) => s.trigger === "manual").length;
  const backupCount = snapshots.filter((s) => s.trigger === "auto").length;
  return (
    `${snapshotCount} snapshot${snapshotCount !== 1 ? "s" : ""}` +
    (backupCount > 0 ? ` · ${backupCount} auto backup${backupCount !== 1 ? "s" : ""}` : "")
  );
}

/** The two snapshots of a comparison, older first. */
export function orderByAge(a: StorySnapshot, b: StorySnapshot): [StorySnapshot, StorySnapshot] {
  return parseServerDate(a.created_at) < parseServerDate(b.created_at) ? [a, b] : [b, a];
}

/** The filename a `Content-Disposition` header names, or the default download name. */
export function filenameFromDisposition(header: string | null): string {
  const match = (header ?? "").match(/filename="([^"]+)"/);
  return match ? match[1] : "snapshot.lorestudio.zip";
}

export interface SnapshotGroup {
  anchor: StorySnapshot | null; // null = ungrouped (pre-dates first snapshot)
  autoBackups: StorySnapshot[];
}

const newestFirst = (a: StorySnapshot, b: StorySnapshot) =>
  serverTime(b.created_at) - serverTime(a.created_at);

/**
 * Each manual snapshot with the auto backups taken against it (newest first), groups
 * newest first, and any auto backups whose anchor is gone in a final ungrouped group.
 */
export function groupSnapshots(snapshots: StorySnapshot[]): SnapshotGroup[] {
  const manuals = snapshots.filter((s) => s.trigger === "manual");
  const autos = snapshots.filter((s) => s.trigger === "auto");

  const groups: SnapshotGroup[] = manuals.map((anchor) => ({
    anchor,
    autoBackups: autos.filter((a) => a.base_snapshot_id === anchor.id).sort(newestFirst),
  }));

  // Any auto backups whose anchor isn't in the current list (e.g., anchor deleted, or full-type auto)
  const groupedAutoIds = new Set(groups.flatMap((g) => g.autoBackups.map((a) => a.id)));
  const ungrouped = autos.filter((a) => !groupedAutoIds.has(a.id)).sort(newestFirst);

  if (ungrouped.length > 0) {
    groups.push({ anchor: null, autoBackups: ungrouped });
  }

  // Sort groups newest-first by anchor; ungrouped (null anchor) goes last
  groups.sort((a, b) => {
    if (!a.anchor) return 1;
    if (!b.anchor) return -1;
    return serverTime(b.anchor.created_at) - serverTime(a.anchor.created_at);
  });

  return groups;
}

export const INTERVAL_OPTIONS = [
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 240, label: "Every 4 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every 24 hours" },
];

export const MAX_COUNT_OPTIONS = [
  { value: 48, label: "48 backups" },
  { value: 96, label: "96 backups" },
  { value: 200, label: "200 backups" },
  { value: 500, label: "500 backups" },
  { value: null, label: "Unlimited" },
];

export const MAX_AGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Never" },
];

export const LOG_LIMIT_OPTIONS = [
  { value: 100, label: "100 entries" },
  { value: 500, label: "500 entries" },
  { value: 1000, label: "1,000 entries" },
  { value: 5000, label: "5,000 entries" },
  { value: null, label: "Unlimited" },
];
