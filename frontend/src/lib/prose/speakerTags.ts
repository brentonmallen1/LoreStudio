/**
 * Hidden speaker tags (2026-10-16): with "Hide speaker tags" on, the `<Name>` after a line is
 * hidden while the caret is elsewhere, and shown while the caret or the selection touches the
 * line: anywhere in its quote or its tag, both edges included.
 *
 * The edges matter. The caret just after the closing quote mark sits at the tag's start;
 * typing there while the tag was hidden would put words between the quote and its tag and
 * silently untag the line. So every caret position that could type into a tag, or between a
 * line and its tag, shows the tag first. A tag that names nobody is never hidden: it is a
 * warning, and the writer needs to see it.
 *
 * Positions here are whatever the caller uses (ProseMirror's, in the editor); the grammar
 * of a tag is lib/prose/syntax's `findSpeakerTags`.
 */

export interface Span {
  from: number;
  to: number;
}

export interface TaggedLine {
  /** The whole line: from its opening quote mark to the tag's ">". */
  line: Span;
  /** The tag, from its "<" (or the space before it) to its ">". */
  tag: Span;
  /** Whether the tag names someone in the story. */
  named: boolean;
}

/** Whether a selection (a caret is from = to) touches a span, either edge included. */
export function touches(span: Span, selection: Span): boolean {
  return selection.from <= span.to && selection.to >= span.from;
}

/** The lines whose tag shows while hidden tags are on: the ones the selection touches. */
export function revealedLines<T extends TaggedLine>(lines: T[], selection: Span): T[] {
  return lines.filter((l) => touches(l.line, selection));
}

/** The tags hidden for this selection: every named tag on a line the selection does not touch. */
export function hiddenTags<T extends TaggedLine>(lines: T[], selection: Span): T[] {
  return lines.filter((l) => l.named && !touches(l.line, selection));
}
