import type { Character } from "../../types";

const ARTICLES = new Set(["the", "a", "an", "dr", "mr", "mrs", "ms", "miss", "sir", "lady", "lord"]);

/**
 * The ways prose refers to a character: the full name, the first name, and a name in
 * brackets ("The Visitor (Calder)" is also "Calder"). Surnames are left out on purpose:
 * Eleanor and Thomas Vance share one, and "Vance" would put both in every scene.
 */
export function nameForms(name: string): string[] {
  const bracketed = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  const plain = name
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const first = plain.split(" ")[0] ?? "";
  const forms = [plain, ...bracketed];
  if (first && first !== plain && first.length > 2 && !ARTICLES.has(first.toLowerCase())) forms.push(first);
  return [...new Set(forms.filter((f) => f.length > 1))];
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Characters the text names, in the order of the cast list. Tags are ignored. */
export function charactersIn(text: string, characters: Character[]): Character[] {
  const plain = text.replace(/<[^>]+>/g, " ");
  return characters.filter((c) =>
    nameForms(c.name).some((form) => new RegExp(`(^|[^\\p{L}])${escape(form)}(?![\\p{L}])`, "u").test(plain)),
  );
}
