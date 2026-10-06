/**
 * Readings by name (doc 19 P4): the picker's quick choices, what each kind of reading is
 * called, and how far apart two are. Human names first, dates second.
 */
import { parseServerDate, serverTime } from "../serverDate";
import type { ReadingSummary } from "../../types/numbers";

const DAY = 24 * 60 * 60 * 1000;

/** What a reading is, in the picker: a version by its name, otherwise how it came to be taken. */
export function readingName(r: Pick<ReadingSummary, "label" | "trigger">): string {
  if (r.label) return r.label;
  switch (r.trigger) {
    case "session":
      return "Start of a session";
    case "daily":
      return "During a session";
    case "manual":
      return "Measured by hand";
    case "snapshot":
      return "A version";
    case "restore":
      return "After a restore";
    default:
      return "An earlier backup";
  }
}

/** Versions: the readings taken with a named snapshot, newest first. */
export function versions(readings: ReadingSummary[]): ReadingSummary[] {
  return readings.filter((r) => r.label).reverse();
}

/** The latest reading at or before `at` (ms). */
export function atOrBefore(readings: ReadingSummary[], at: number): ReadingSummary | null {
  for (let i = readings.length - 1; i >= 0; i--)
    if (serverTime(readings[i].taken_at) <= at) return readings[i];
  return null;
}

export interface QuickChoice {
  id: "session" | "last" | "week" | "month";
  name: string;
  reading: ReadingSummary | null;
}

/** The picker's first rows. A choice with no reading that far back is offered, disabled. */
export function quickChoices(readings: ReadingSummary[], now = Date.now()): QuickChoice[] {
  const sessions = readings.filter((r) => r.trigger === "session");
  return [
    { id: "session", name: "This session", reading: sessions[sessions.length - 1] ?? null },
    { id: "last", name: "Last session", reading: sessions[sessions.length - 2] ?? null },
    { id: "week", name: "A week ago", reading: atOrBefore(readings, now - 7 * DAY) },
    { id: "month", name: "A month ago", reading: atOrBefore(readings, now - 30 * DAY) },
  ];
}

/** Where comparing starts (D4): the latest version, else the reading before now. */
export function defaultFrom(readings: ReadingSummary[]): ReadingSummary | null {
  return versions(readings)[0] ?? readings[readings.length - 1] ?? null;
}

/** "today 09:12", "yesterday 18:40", "Wed 1 Oct 14:02". */
export function when(takenAt: string, now = Date.now()): string {
  const t = parseServerDate(takenAt);
  const time = t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const midnight = (ms: number) => {
    const d = new Date();
    d.setTime(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((midnight(now) - midnight(t.getTime())) / DAY);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  const date = t.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${date} ${time}`;
}

/** How far apart two moments are: "5 days", "3 hours", "40 minutes". */
export function apart(a: number, b: number): string {
  const ms = Math.abs(b - a);
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (ms >= DAY) return unit(Math.round(ms / DAY), "day");
  if (ms >= 60 * 60 * 1000) return unit(Math.round(ms / (60 * 60 * 1000)), "hour");
  return unit(Math.max(1, Math.round(ms / 60000)), "minute");
}
