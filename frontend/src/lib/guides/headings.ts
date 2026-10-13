import { Children, isValidElement, type ReactNode } from "react";

/** "Make it comfortable" → "make-it-comfortable": a guide heading's id, for its link on the page. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The words of a heading as rendered, through its bold, code and links. */
export function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
      return "";
    })
    .join("");
}

export interface PageHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** The heading the reader is in: the last one whose top has passed `line`. At the very end of
 * the page a short last section never reaches the line: there it is the section the reader
 * went to (`chosen`, from the address) while it is in view (`height`), or else the last. */
export function currentHeading(
  tops: { id: string; top: number }[],
  line: number,
  end?: { height: number; chosen?: string },
): string | null {
  if (tops.length === 0) return null;
  if (end) {
    const chosen = tops.find((h) => h.id === end.chosen);
    return chosen && chosen.top >= 0 && chosen.top < end.height ? chosen.id : tops[tops.length - 1].id;
  }
  let current = tops[0].id;
  for (const h of tops) if (h.top <= line) current = h.id;
  return current;
}
