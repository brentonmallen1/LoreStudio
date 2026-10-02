/** The Freewrite page's day headings (doc 15 N3): "Friday 2 October". */
export function dayLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `${weekday} ${day}`;
}

/** The last day heading on the page, or null when it has none. */
export function lastDay(html: string): string | null {
  const all = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)];
  return all.length ? all[all.length - 1][1].replace(/<[^>]+>/g, "").trim() : null;
}

/**
 * A day heading added on opening the page with nothing written under it yet is not kept:
 * opening the page is not writing on it.
 */
export function trimEmptyDay(html: string): string {
  return html.replace(/<h3[^>]*>[^<]*<\/h3>(\s*<p>\s*<\/p>)*\s*$/, "");
}
