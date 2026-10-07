import { CHARACTER_QUESTIONS, KINDS } from "../../../lib/lorebook/kinds";
import type { Character } from "../../../types";
import FieldList from "../FieldList";
import BlockHeading, { type About } from "./BlockHeading";
import styles from "./WhoAreThey.module.css";

const QUESTIONS = KINDS.character.fields.filter((f) => CHARACTER_QUESTIONS.includes(f.key));

const ABOUT: About = {
  parts: [
    [
      "What it is",
      [
        "Goal, Motivation and Conflict, from Debra Dixon's book of that name (1996): what a character wants, why they want it, and why they can't simply have it. Many writers add a fourth question, the stakes: what happens if they don't get it.",
      ],
    ],
    [
      "Why it is here",
      [
        "Between them the answers drive a character's scenes: something to chase, a reason it matters, and something in the way. Needs and Believes, below, are the other half of the arc: what would actually make them whole, and the lie the story tests.",
      ],
    ],
    [
      "How to read it",
      [
        "Every answer is optional, and an empty one is only a word in the Add row. Plan › The essentials asks the same questions of each main character, and the character interview speaks from these answers.",
      ],
    ],
  ],
};

/**
 * The three questions, together and first on a character's Overview (doc 20 P5): what do they
 * want, why, what stands in the way, and what if they don't get it.
 */
export default function ThreeQuestions({
  character,
  save,
}: {
  character: Character;
  save: (key: string, value: string) => Promise<unknown>;
}) {
  return (
    <section className={styles.block} aria-labelledby="three-questions">
      <BlockHeading id="three-questions" title="The three questions" about={ABOUT} />
      <FieldList
        entityKey={`${character.id}:questions`}
        fields={QUESTIONS}
        values={character as unknown as Record<string, unknown>}
        save={save}
      />
    </section>
  );
}
