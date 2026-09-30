import { Link } from "react-router-dom";
import { useStoryStore } from "../../../stores/storyStore";
import type { Character, Story, StructureNode } from "../../../types";
import { nextStep, sceneLeaves } from "../../../lib/planning/methods";
import { usePlanData } from "../../../lib/planning/usePlanData";
import { charactersIn } from "../../../lib/planning/whoIsInScene";
import QuestionsList from "../../plan/QuestionsList";
import styles from "./StoryPlanPanel.module.css";

interface Props {
  node: StructureNode;
  story: Story;
  characters: Character[];
}

/**
 * The story's plan beside the prose (refactor doc 10 P5): the logline and conflict, where
 * this scene sits, and what the people in it want. Read-only here; the Plan page and the
 * character sheets are where it is written.
 */
export default function StoryPlanPanel({ node, story, characters }: Props) {
  const { structure, activeTemplate } = useStoryStore();
  const scenes = sceneLeaves(structure, activeTemplate);
  const index = scenes.findIndex((s) => s.id === node.id);
  const povId = node.pov_character_id ?? story.pov_character_id;
  // A planned scene has no prose yet: who it is about is in its synopsis.
  const present = charactersIn(`${node.content ?? ""} ${node.synopsis ?? ""}`, characters);
  const pov = characters.find((c) => c.id === povId);
  const people = pov && !present.includes(pov) ? [pov, ...present] : present;
  const { data, method } = usePlanData();
  const next = method && data ? nextStep(method, data) : null;
  const planPath = `/stories/${story.id}/plan`;

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h4 className={styles.heading}>The story</h4>
        {story.logline ? (
          <p className={styles.logline}>{story.logline}</p>
        ) : (
          <p className={styles.empty}>
            No one-sentence summary yet. <Link to={planPath}>Write one on the Plan page</Link>
          </p>
        )}
        {story.central_conflict && (
          <p className={styles.fact}>
            <span className={styles.label}>Conflict</span>
            <span>{story.central_conflict}</span>
          </p>
        )}
      </section>

      {index >= 0 && (
        <section className={styles.section}>
          <h4 className={styles.heading}>This scene</h4>
          <p className={styles.fact}>
            <span className={styles.label}>Place</span>
            <span>
              Scene {index + 1} of {scenes.length}
              {index > 0 && <span className={styles.after}> · after “{scenes[index - 1].title}”</span>}
            </span>
          </p>
          {index < scenes.length - 1 && scenes[index + 1].synopsis && (
            <p className={styles.fact}>
              <span className={styles.label}>Next</span>
              <span>{scenes[index + 1].synopsis}</span>
            </p>
          )}
        </section>
      )}

      <section className={styles.section}>
        <h4 className={styles.heading}>Who's here</h4>
        {people.length === 0 ? (
          <p className={styles.empty}>No one from the cast is named in this scene yet.</p>
        ) : (
          <ul className={styles.people}>
            {people.map((c) => (
              <li key={c.id} className={styles.person}>
                <Link to={`/stories/${story.id}/lorebook/characters/${c.id}`} className={styles.name}>
                  {c.name}
                  {c.id === povId && <span className={styles.pov}>POV</span>}
                </Link>
                {c.mission_statement && (
                  <p className={styles.fact}>
                    <span className={styles.label}>Wants</span>
                    <span>{c.mission_statement}</span>
                  </p>
                )}
                {c.conflict && (
                  <p className={styles.fact}>
                    <span className={styles.label}>Against</span>
                    <span>{c.conflict}</span>
                  </p>
                )}
                {!c.mission_statement && !c.conflict && (
                  <p className={styles.empty}>No goal or conflict written yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.heading}>Open questions about this scene</h4>
        <QuestionsList
          storyId={story.id}
          subject={{ node_id: node.id }}
          compact
          placeholder="Something undecided here… (Enter)"
        />
      </section>

      <footer className={styles.foot}>
        {next ? (
          <Link to={`${planPath}?step=${next.id}`}>Next in the plan: {next.label}</Link>
        ) : (
          <Link to={planPath}>Open the Plan page</Link>
        )}
      </footer>
    </div>
  );
}
