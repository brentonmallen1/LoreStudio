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
