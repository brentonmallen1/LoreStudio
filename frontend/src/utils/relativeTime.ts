import { parseServerDate, serverTime } from "../lib/serverDate";
/**
 * "3m ago", "2d ago", or a date once it is more than a week old.
 *
 * Was copied into four files; one of them is enough.
 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - serverTime(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return parseServerDate(iso).toLocaleDateString();
}
