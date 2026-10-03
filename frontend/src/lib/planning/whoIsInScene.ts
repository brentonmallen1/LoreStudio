import type { Character } from "../../types";
import { presencePatterns, timesNamed } from "../prose/syntax";

/**
 * Characters the text names, in the order of the cast list, by the server's presence rule
 * (lib/prose/syntax presencePatterns): full, other and short names that only they go by,
 * never a title or an article, a one-word name only as capitalised. Tags are ignored.
 */
export function charactersIn(text: string, characters: Character[]): Character[] {
  const plain = text.replace(/<[^>]+>/g, " ");
  const patterns = presencePatterns(
    characters.map((c) => ({ kind: "character" as const, name: c.name, aliases: c.aliases ?? [] })),
  );
  return characters.filter((c) => timesNamed(plain, patterns.get(c.name) ?? []) > 0);
}
