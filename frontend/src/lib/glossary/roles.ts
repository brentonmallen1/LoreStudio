import type { TermId } from "./index";

const ROLE_TERMS: Record<string, TermId> = {
  protagonist: "protagonist",
  antagonist: "antagonist",
  deuteragonist: "deuteragonist",
  foil: "foil",
  mentor: "mentor",
};

/** The glossary word for a character's role: its own entry, or "Role" for the rest. */
export function roleTerm(role: string): TermId {
  return ROLE_TERMS[role] ?? "character-role";
}
