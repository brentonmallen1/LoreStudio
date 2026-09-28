/**
 * Today's writing, per story: minutes spent actually writing and the net words added.
 *
 * Time counts only while the author is typing: each tick adds its seconds if there was
 * writing activity within the idle window, so leaving the tab open over lunch adds
 * nothing. Words are net per scene (its count now minus its count when first opened
 * today), so deleting a paragraph shows as fewer words, not more. Kept in localStorage
 * per story and day — a quiet personal record, not something the server needs.
 */

export const TICK_SECONDS = 15;
export const IDLE_SECONDS = 120;

export interface Today {
  day: string;
  activeSeconds: number;
  /** Scene word counts when first seen today, and now. */
  baselines: Record<string, number>;
  current: Record<string, number>;
}

export function localDay(now: number): string {
  // en-CA formats as YYYY-MM-DD in the reader's own time zone.
  // eslint-disable-next-line no-restricted-syntax -- `now` is this browser's clock, not an API timestamp
  return new Date(now).toLocaleDateString("en-CA");
}

export function emptyToday(day: string): Today {
  return { day, activeSeconds: 0, baselines: {}, current: {} };
}

/** Record a scene's word count; the first count seen today is its baseline. */
export function withWordCount(t: Today, nodeId: string, words: number): Today {
  return {
    ...t,
    baselines: nodeId in t.baselines ? t.baselines : { ...t.baselines, [nodeId]: words },
    current: { ...t.current, [nodeId]: words },
  };
}

/** One tick of the clock: counts only when there was writing within the idle window. */
export function withTick(t: Today, now: number, lastActivity: number | null): Today {
  if (lastActivity === null || now - lastActivity > IDLE_SECONDS * 1000) return t;
  return { ...t, activeSeconds: t.activeSeconds + TICK_SECONDS };
}

export function netWords(t: Today): number {
  return Object.keys(t.current).reduce(
    (sum, id) => sum + t.current[id] - (t.baselines[id] ?? t.current[id]),
    0,
  );
}

export function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

// ── Storage and the activity signal ──────────────────────────────────────

const key = (storyId: string) => `ls_today:${storyId}`;

export function loadToday(storyId: string, day: string): Today {
  try {
    const saved = JSON.parse(localStorage.getItem(key(storyId)) ?? "null") as Today | null;
    return saved?.day === day ? saved : emptyToday(day);
  } catch {
    return emptyToday(day);
  }
}

export function saveToday(storyId: string, t: Today): void {
  try {
    localStorage.setItem(key(storyId), JSON.stringify(t));
  } catch {
    // A full or refused storage only loses the tally, never writing.
  }
}

let lastActivity: number | null = null;

/** Called by the editor on every change the author makes. */
export function noteWritingActivity(now: number = Date.now()): void {
  lastActivity = now;
}

export function lastWritingActivity(): number | null {
  return lastActivity;
}

// ── A small store the topbar subscribes to ───────────────────────────────

let current: { storyId: string; today: Today } | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function emit() {
  listeners.forEach((l) => l());
}

function ensure(storyId: string, now: number): Today {
  const day = localDay(now);
  if (!current || current.storyId !== storyId || current.today.day !== day) {
    current = { storyId, today: loadToday(storyId, day) };
  }
  return current.today;
}

/** Note a scene's word count in the open story (its saved count, so always its own). */
export function trackScene(storyId: string, nodeId: string, words: number, now: number = Date.now()): void {
  const next = withWordCount(ensure(storyId, now), nodeId, words);
  current = { storyId, today: next };
  saveToday(storyId, next);
  emit();
}

export function subscribeToday(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    if (!current) return;
    const now = Date.now();
    const before = ensure(current.storyId, now);
    const next = withTick(before, now, lastActivity);
    if (next === before) return;
    current = { storyId: current.storyId, today: next };
    saveToday(current.storyId, next);
    emit();
  }, TICK_SECONDS * 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function todaySnapshot(): { storyId: string; today: Today } | null {
  return current;
}
