import { slotVar } from "../colorSlots";
import { roleLabel } from "../threads/roles";
import type { PromiseAcross, Promises } from "../../types/promises";
import { setupSentence, setupType } from "./setups";

/** How a mark is drawn on the tapestry; the legend names each one. */
export type MarkShape =
  | "opens"
  | "moves"
  | "turns"
  | "fails"
  | "succeeds"
  | "closes"
  | "toward"
  | "away"
  | "reveal"
  | "setup"
  | "payoff";

export interface Mark {
  index: number;
  nodeId: string;
  shape: MarkShape;
  /** Said on hover and to a screen reader: the scene, what happens there, the note. */
  label: string;
}

export interface Lane {
  id: string;
  kind: "thread" | "twist" | "setup";
  name: string;
  /** A token: the thread's or twist's palette slot; setups are neutral. */
  color: string;
  /** From the first mark to the last, in scene indexes; null with fewer than two. */
  span: [number, number] | null;
  marks: Mark[];
  /** Set aside, or with nothing placed yet: drawn quieter. */
  quiet: boolean;
  /** In a series: where it comes from and goes on to, drawn as a lead-in and a lead-out. */
  edgeIn: string | null;
  edgeOut: string | null;
}

export interface LaneGroup {
  id: "threads" | "twists" | "setups";
  label: string;
  lanes: Lane[];
}

const ROLE_SHAPE: Record<string, MarkShape> = {
  opens: "opens",
  moves: "moves",
  turns: "turns",
  complicates: "turns",
  fails: "fails",
  fails_worse: "fails",
  costs: "succeeds",
  succeeds: "succeeds",
  closes: "closes",
};

const book = (p: number) => `Book ${p + 1}`;

/** A thread or twist that runs across books: the book it comes from, and where it goes. */
function edges(a: PromiseAcross | undefined, here: number | null): Pick<Lane, "edgeIn" | "edgeOut"> {
  if (!a || here === null) return { edgeIn: null, edgeOut: null };
  const later = (p: number | undefined) => p !== undefined && p > here;
  const out =
    a.continues_in !== null
      ? `on to ${book(a.continues_in)}`
      : later(a.resolved_in?.position)
        ? `closes in ${book(a.resolved_in!.position)}`
        : later(a.revealed_in?.position)
          ? `revealed in ${book(a.revealed_in!.position)}`
          : null;
  return { edgeIn: a.from_book !== null ? `from ${book(a.from_book)}` : null, edgeOut: out };
}

function spanOf(marks: Mark[]): [number, number] | null {
  if (marks.length < 2) return null;
  const at = marks.map((m) => m.index);
  return [Math.min(...at), Math.max(...at)];
}

/**
 * The tapestry's rows (doc 18 C4): each thread with its scenes marked by what they do, each
 * twist with its clues (toward the truth or away) and its reveal, each setup from the scene
 * that plants it to the one that pays it off.
 */
export function tapestryLanes(data: Promises): LaneGroup[] {
  const title = (i: number) => data.scenes[i]?.title ?? "a scene";
  const threads: Lane[] = data.threads.map((t) => {
    const marks = t.beats.map((b) => ({
      index: b.index,
      nodeId: b.node_id,
      shape: ROLE_SHAPE[b.role] ?? "moves",
      label: `${title(b.index)}: ${roleLabel(b.role)}${b.note ? `. ${b.note}` : ""}`,
    }));
    return {
      id: t.id,
      kind: "thread",
      name: t.name,
      color: slotVar(t.color_slot),
      span: spanOf(marks),
      marks,
      quiet: t.status === "set_aside" || (marks.length === 0 && !data.across?.[t.id]),
      ...edges(data.across?.[t.id], data.book),
    };
  });
  const twists: Lane[] = data.twists.map((tw) => {
    const marks: Mark[] = tw.clues
      .filter((c) => c.index !== null && c.node_id)
      .map((c) => ({
        index: c.index!,
        nodeId: c.node_id!,
        shape: c.points_to === "truth" ? "toward" : "away",
        label: `${title(c.index!)}: a clue ${c.points_to === "truth" ? "toward the truth" : "away from it"} (${c.subtlety}). ${c.text || `“${c.quote}”`}`,
      }));
    if (tw.reveal_index !== null && tw.reveal_node_id) {
      marks.push({
        index: tw.reveal_index,
        nodeId: tw.reveal_node_id,
        shape: "reveal",
        label: `${title(tw.reveal_index)}: revealed`,
      });
    }
    marks.sort((a, b) => a.index - b.index);
    return {
      id: tw.id,
      kind: "twist",
      name: tw.name,
      color: slotVar(tw.color_slot),
      span: spanOf(marks),
      marks,
      quiet: marks.length === 0 && !data.across?.[tw.id],
      ...edges(data.across?.[tw.id], data.book),
    };
  });
  const setups: Lane[] = data.setups.map((s) => {
    const sentence = setupSentence(s.link_type, title(s.from_index), title(s.to_index));
    return {
      id: s.id,
      kind: "setup",
      name: sentence,
      color: "var(--color-text-muted)",
      span: [s.from_index, s.to_index],
      marks: [
        {
          index: s.from_index,
          nodeId: s.from_node_id,
          shape: "setup",
          label: `${title(s.from_index)}: ${setupType(s.link_type).label.toLowerCase()}${s.note ? `. ${s.note}` : ""}`,
        },
        {
          index: s.to_index,
          nodeId: s.to_node_id,
          shape: "payoff",
          label: `${title(s.to_index)}: ${sentence}`,
        },
      ],
      quiet: false,
      edgeIn: null,
      edgeOut: null,
    };
  });
  return [
    { id: "threads", label: "Threads", lanes: threads },
    { id: "twists", label: "Twists", lanes: twists },
    { id: "setups", label: "Setups and payoffs", lanes: setups },
  ];
}

/** The legend, in the order a reader meets the shapes. */
export const LEGEND: { shape: MarkShape; label: string }[] = [
  { shape: "opens", label: "opens" },
  { shape: "moves", label: "moves it on" },
  { shape: "turns", label: "turns or complicates it" },
  { shape: "fails", label: "a try that fails" },
  { shape: "succeeds", label: "a try that succeeds" },
  { shape: "closes", label: "closes" },
  { shape: "toward", label: "clue toward the truth" },
  { shape: "away", label: "clue away from it" },
  { shape: "reveal", label: "reveal" },
];
