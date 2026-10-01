/**
 * Reading a timestamp the API sent.
 *
 * The server stores UTC and sends it without an offset — `2026-09-25T21:23:41.781` —
 * and `new Date()` reads an offset-less date-time as *local* time. West of Greenwich
 * that puts every server time hours in the future: "3h ago" rendered as "just now",
 * and a draft typed offline looked older than the server copy and was thrown away.
 * Everything that turns an API timestamp into a Date goes through here; ESLint holds
 * the line (`no-restricted-syntax` on `new Date(x)`).
 */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseServerDate(value: string): Date {
  // A bare date ("2026-09-25") is a calendar day, not an instant; leave it alone.
  const isDateTime = value.includes("T");
  // eslint-disable-next-line no-restricted-syntax -- this is the one place allowed to
  return new Date(isDateTime && !HAS_OFFSET.test(value) ? `${value}Z` : value);
}

/** Milliseconds since the epoch, for sorting and arithmetic. */
export function serverTime(value: string): number {
  return parseServerDate(value).getTime();
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function ago(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "never";
  const min = Math.max(0, Math.round((now - serverTime(value)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return parseServerDate(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
