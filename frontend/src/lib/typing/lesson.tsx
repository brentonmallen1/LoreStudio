import type { ReactNode } from "react";
import type { StructureNode } from "../../types";
import { withKeys } from "../../guides";
import type { HelperId } from "./helpers";

/** A tutorial scene's lesson (doc 26, P6), as the seed writes it in `metadata_.lesson`. */
export interface Lesson {
  text: string;
  practice: { id: HelperId; task: string }[];
  number: number;
  of: number;
  topic: string;
}

export function lessonOf(node: StructureNode | null | undefined): Lesson | null {
  const lesson = (node?.metadata_ as { lesson?: Lesson } | undefined)?.lesson;
  return lesson && typeof lesson.text === "string" ? lesson : null;
}

/** "Type `^` and choose" with the key in a box, and {{key:id}} as this platform writes it. */
export function lessonText(text: string): ReactNode[] {
  return withKeys(text)
    .split(/(`[^`]+`)/)
    .map((part, i) => (part.startsWith("`") ? <kbd key={i}>{part.slice(1, -1)}</kbd> : part));
}
