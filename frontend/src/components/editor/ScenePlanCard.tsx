import { useStoryStore } from "../../stores/storyStore";
import type { Character, Story, StructureNode } from "../../types";
import styles from "./ScenePlanCard.module.css";

interface Props {
  node: StructureNode;
  story: Story | null;
  characters: Character[];
  onOpenNotes: () => void;
}

/**
 * The plan for a scene, shown above it while it is empty (refactor doc 10 P5): opening a
 * planned scene starts from what you decided it was for, not a blank page. The first
 * words tuck it away; the same fields stay in the Notes panel.
 */
export default function ScenePlanCard({ node, story, characters, onOpenNotes }: Props) {
  const beatSheets = useStoryStore((s) => s.beatSheets);
  const beat =
    node.beat_id && story?.beat_sheet_id
      ? beatSheets.find((s) => s.id === story.beat_sheet_id)?.beats.find((b) => b.id === node.beat_id)
      : undefined;
  const pov = characters.find((c) => c.id === (node.pov_character_id ?? story?.pov_character_id));
  const has = (v: string | null | undefined) => !!v && v.trim().length > 0;

  if (![node.synopsis, node.purpose, node.entry_state, node.exit_state].some(has)) return null;

  return (
    <aside className={styles.card} aria-label="The plan for this scene">
      <div className={styles.head}>
        <span className={styles.eyebrow}>The plan for this scene</span>
        {beat && <span className={styles.beat}>{beat.name}</span>}
      </div>
      {has(node.synopsis) && <p className={styles.synopsis}>{node.synopsis}</p>}
      <dl className={styles.facts}>
        {has(node.purpose) && (
          <>
            <dt>Why it's here</dt>
            <dd>{node.purpose}</dd>
          </>
        )}
        {has(node.entry_state) && (
          <>
            <dt>Starts</dt>
            <dd>{node.entry_state}</dd>
          </>
        )}
        {has(node.exit_state) && (
          <>
            <dt>Ends</dt>
            <dd>{node.exit_state}</dd>
          </>
        )}
        {pov && has(pov.mission_statement) && (
          <>
            <dt>{pov.name} wants</dt>
            <dd>{pov.mission_statement}</dd>
          </>
        )}
      </dl>
      <div className={styles.foot}>
        <span>Start writing below; this tucks away.</span>
        <button
          type="button"
          className={styles.link}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotes();
          }}
        >
          Edit in scene notes
        </button>
      </div>
    </aside>
  );
}
