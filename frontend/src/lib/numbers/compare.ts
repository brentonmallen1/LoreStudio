/**
 * Two sides of a comparison (doc 19 P5): what differs, as data for the charts' marks and as a
 * few plain sentences for What changed. Everything is matched by id, so a renamed scene is the
 * same scene and a moved one is listed as moved. Nothing here judges a change: more words is
 * not better, and the sentences only say what moved and by how much.
 */
import type { Figures } from "./figures";

/** A change as a signed figure, "+412" or "−120"; empty when there is none. */
export function signed(d: number, digits = 0): string {
  if (!d) return "";
  const v = Math.abs(d);
  return `${d > 0 ? "+" : "−"}${digits ? v.toFixed(digits) : v.toLocaleString()}`;
}

export interface SceneChanges {
  /** Scenes that were not there then. */
  added: Set<string>;
  /** Scenes there then and gone now, with their title then. */
  removed: { id: string; title: string }[];
  /** Scenes whose place in the book changed (1-based, then and now). */
  moved: { id: string; title: string; from: number; to: number }[];
  /** Each scene's words then. */
  wordsThen: Map<string, number>;
}

export function sceneChanges(then: Figures, now: Figures): SceneChanges {
  const thenAt = new Map(then.scenes.map((s, i) => [s.id, i]));
  const nowIds = new Set(now.scenes.map((s) => s.id));
  // Order among the scenes on both sides: a scene added before another does not "move" it.
  const both = now.scenes.filter((s) => thenAt.has(s.id));
  const rankThen = [...both].sort((a, b) => thenAt.get(a.id)! - thenAt.get(b.id)!).map((s) => s.id);
  return {
    added: new Set(now.scenes.filter((s) => !thenAt.has(s.id)).map((s) => s.id)),
    removed: then.scenes.filter((s) => !nowIds.has(s.id)).map((s) => ({ id: s.id, title: s.title })),
    moved: both.flatMap((s, i) => {
      const was = rankThen.indexOf(s.id);
      return was === i
        ? []
        : [{ id: s.id, title: s.title, from: thenAt.get(s.id)! + 1, to: now.scenes.indexOf(s) + 1 }];
    }),
    wordsThen: new Map(then.bars.map((b) => [b.id, b.words])),
  };
}

/** Each character's scenes then, by scene id, for the cast grid's gained and lost cells. */
export function castThen(then: Figures): Map<string, Set<string>> {
  return new Map(
    then.cast.map((r) => [
      r.character.id,
      new Set(then.scenes.filter((_, i) => r.present[i]).map((s) => s.id)),
    ]),
  );
}

/** Each thread's marks then, as "scene:role", for the lanes' new and gone marks. */
export function marksThen(then: Figures): Map<string, Set<string>> {
  return new Map(then.lanes.map((l) => [l.thread.id, new Set(l.marks.map((m) => `${m.nodeId}:${m.role}`))]));
}

/** Each speaker's share of the words spoken then (0–100), by character id or name. */
export function sharesThen(then: Figures): Map<string, number> {
  const spoken = then.dialogue.speakers.reduce((a, s) => a + s.word_count, 0);
  return new Map(
    then.dialogue.speakers.map((s) => [
      s.character_id ?? s.speaker_name,
      spoken ? (s.word_count / spoken) * 100 : 0,
    ]),
  );
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** What changed, in a few plain sentences, most telling first. */
export function whatChanged(then: Figures, now: Figures): string[] {
  const out: string[] = [];
  const scenes = sceneChanges(then, now);

  const dw = now.words.total - then.words.total;
  const parts = [dw === 0 ? "the same number of words" : moreOrFewer(dw, "word")];
  if (scenes.added.size) parts.push(`${count(scenes.added.size, "new scene")}`);
  if (scenes.removed.length)
    parts.push(
      `${count(scenes.removed.length, "scene")} removed (${list(scenes.removed.slice(0, 3).map((s) => `“${s.title}”`))})`,
    );
  if (scenes.moved.length) parts.push(`${count(scenes.moved.length, "scene")} moved`);
  out.push(capital(`${list(parts)}.`));

  const before = new Map(then.cast.map((r) => [r.character.id, r.count]));
  const shifts = now.cast
    .map((r) => ({ name: r.character.name, d: r.count - (before.get(r.character.id) ?? 0) }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 3);
  if (shifts.length)
    out.push(
      capital(
        `${list(shifts.map((x, i) => `${x.name} ${i === 0 ? "is on the page in " : "in "}${moreOrFewer(x.d, "scene")}`))}.`,
      ),
    );

  const statusThen = new Map(then.threads.map((t) => [t.id, t.status]));
  // A status the earlier reading did not record says nothing about a change.
  const turned = now.threads.filter((t) => statusThen.get(t.id) && statusThen.get(t.id) !== t.status);
  const newThreads = now.threads.filter((t) => !statusThen.has(t.id));
  const threadParts = [
    ...turned.slice(0, 2).map((t) => `${t.name} went from ${statusThen.get(t.id)} to ${t.status}`),
    ...(newThreads.length ? [`${count(newThreads.length, "new thread")}`] : []),
  ];
  if (threadParts.length) out.push(capital(`${list(threadParts)}.`));

  const dl = now.dialogue.total_lines - then.dialogue.total_lines;
  const b0 = then.dialogue.balance;
  const b1 = now.dialogue.balance;
  if (dl !== 0 || b0 !== b1) {
    const lines = dl === 0 ? "the same lines of dialogue" : `${moreOrFewer(dl, "line")} of dialogue`;
    const balance = b0 !== null && b1 !== null && b0 !== b1 ? `, balance ${b0} → ${b1}` : "";
    out.push(capital(`${lines}${balance}.`));
  }

  if (now.prose && !then.prose) out.push("Prose was not measured by then.");
  else if (now.prose && then.prose) {
    const p = then.prose;
    const q = now.prose;
    const moves = [
      p.passive_pct !== q.passive_pct && `passive ${p.passive_pct}% → ${q.passive_pct}%`,
      p.adverb_pct !== q.adverb_pct && `adverbs ${p.adverb_pct}% → ${q.adverb_pct}%`,
      p.mean_sentence !== q.mean_sentence && `average sentence ${p.mean_sentence} → ${q.mean_sentence} words`,
    ].filter(Boolean) as string[];
    if (moves.length) out.push(capital(`Prose: ${list(moves)}.`));
  }

  if (then.findings && now.findings) {
    const total = (f: Record<string, number>) => Object.values(f).reduce((a, b) => a + b, 0);
    const a = total(then.findings);
    const b = total(now.findings);
    if (a !== b) out.push(`Open findings: ${a} → ${b}.`);
  }
  return out;
}

function moreOrFewer(d: number, one: string, many = `${one}s`): string {
  return d > 0 ? count(d, `more ${one}`, `more ${many}`) : count(-d, `fewer ${one}`, `fewer ${many}`);
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
