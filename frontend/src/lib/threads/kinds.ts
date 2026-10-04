import type { MICEType } from "../../types";

/**
 * What kind of promise a thread is, in plain words (doc 18 D3), with Mary Robinette Kowal's
 * MICE name in small print: a place, a question, a change, a disruption.
 */
export const THREAD_KINDS: { value: MICEType; label: string; mice: string; hint: string }[] = [
  {
    value: "milieu",
    label: "A place",
    mice: "milieu",
    hint: "Opens when we arrive somewhere, closes when we leave.",
  },
  {
    value: "idea",
    label: "A question",
    mice: "idea",
    hint: "Opens with a question, closes with its answer.",
  },
  {
    value: "character",
    label: "A change",
    mice: "character",
    hint: "Opens when someone is unhappy with who they are, closes when they change, or refuse to.",
  },
  {
    value: "event",
    label: "A disruption",
    mice: "event",
    hint: "Opens when the world is knocked out of order, closes when a new order holds.",
  },
];

export const kindOf = (mice: string | null | undefined) => THREAD_KINDS.find((k) => k.value === mice);

/** "A question", or "" for a thread with no kind. */
export const kindLabel = (mice: string | null | undefined) => kindOf(mice)?.label ?? "";
