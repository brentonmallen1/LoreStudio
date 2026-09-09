/**
 * Pulling a server error out of a text stream (review 1.3).
 *
 * A streaming response has already sent `200 text/plain` before the first token, so a
 * later failure cannot change the status. The server used to append `[Error: ...]` to the
 * body, which meant the client could not tell "the model said this" from "the server
 * broke" - and the raw exception, saved to history, read like something the model wrote.
 *
 * The server now ends a failed stream with U+001E and a JSON frame. A record separator is
 * not something a language model emits, so anything after it is control data, not prose.
 */

/** U+001E RECORD SEPARATOR - matches STREAM_ERROR_SENTINEL in the backend. */
export const STREAM_ERROR_SENTINEL = "\u001e";

export interface SplitStream {
  /** What the model actually produced, safe to render and to persist. */
  text: string;
  /** A message to show as an error, if the stream ended in one. */
  error?: string;
}

export function splitStreamError(raw: string): SplitStream {
  const at = raw.indexOf(STREAM_ERROR_SENTINEL);
  if (at === -1) return { text: raw };

  const text = raw.slice(0, at);
  const frame = raw.slice(at + STREAM_ERROR_SENTINEL.length);
  try {
    const parsed = JSON.parse(frame) as { error?: string };
    return { text, error: parsed.error || "Something went wrong." };
  } catch {
    // A truncated frame still means the stream failed; the text before it is real.
    return { text, error: "Something went wrong." };
  }
}
