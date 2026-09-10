/**
 * Reading text that was stored before reasoning had its own event.
 *
 * The server now separates them: `content` is prose, and thinking is delivered on a
 * `thinking` event. Rows written earlier still have the sentinels inside the text, so
 * anything that renders stored history passes it through here first. Nothing that reads
 * a live stream should need this.
 */
const STORED_THOUGHT_RE = /<\|channel>thought\n[\s\S]*?<channel\|>/g;

export function stripStoredThoughts(text: string): string {
  return text.replace(STORED_THOUGHT_RE, "").trim();
}
