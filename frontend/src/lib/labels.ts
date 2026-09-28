/**
 * Stored values in the author's words: "natural_feature" → "Natural feature".
 * World Building showed the raw values as tags and in its type select.
 */
export function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
