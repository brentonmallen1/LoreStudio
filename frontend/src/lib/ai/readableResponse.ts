/**
 * A recorded model response, read for people (Chronicle's Response tab, Readable): the
 * code fence a model wraps its JSON in comes off, JSON is parsed so it can be laid out, and
 * anything else is text to show as Markdown. Pure, so the rules are tested apart from the view.
 */

export type ReadableResponse =
  { kind: "empty" } | { kind: "json"; data: unknown } | { kind: "text"; text: string };

const FENCE = /^```[\w-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/;

/** The inside of a response that is one fenced block (```json … ```); anything else as it is. */
export function stripFences(text: string): string {
  const trimmed = text.trim();
  const m = FENCE.exec(trimmed);
  return m ? m[1].trim() : trimmed;
}

/** What a response is: nothing, JSON to lay out, or text (prose, or JSON that will not parse). */
export function readResponse(raw: string | null | undefined): ReadableResponse {
  const text = (raw ?? "").trim();
  if (!text) return { kind: "empty" };
  const inner = stripFences(text);
  if (/^[[{]/.test(inner)) {
    try {
      return { kind: "json", data: JSON.parse(inner) };
    } catch {
      // Broken JSON reads better as text than as nothing; Raw shows it exactly.
    }
  }
  return { kind: "text", text };
}
