import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { FROM_FIRST_LINE, sceneLine } from "../../../lib/outline/summary";
import { sceneLeaves } from "../../../lib/planning/methods";
import { useStoryStore } from "../../../stores/storyStore";
import type { StructureNode } from "../../../types";
import { useOutlineActions } from "../../outliner/useOutlineActions";
import styles from "./Written.module.css";

/** Scenes shown before "+ N more". */
const SHOWN = 8;

/**
 * Your story so far (doc 29 D6): each scene in a line, from its line of what happens or else its
 * first line, marked. The lines are the Outline's: editing one here writes the scene's line of
 * what happens, as a change ⌘Z takes back.
 */
export default function StorySoFar({ storyId, long }: { storyId: string; long: Set<string> }) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const [all, setAll] = useState(false);
  const scenes = sceneLeaves(structure, template);
  const shown = all ? scenes : scenes.slice(0, SHOWN);
  return (
    <section className={styles.part} aria-labelledby="written-so-far">
      <h3 id="written-so-far" className={styles.heading}>
        Your story so far
      </h3>
      <p className={styles.lead}>
        Each scene in a line, taken from what you wrote. These are your Outline's lines too: edit one to say
        it better.
      </p>
      {scenes.length === 0 ? (
        <p className={styles.quiet}>No scenes yet. Each one shows here as you write it.</p>
      ) : (
        <ol className={styles.scenes}>
          {shown.map((node, i) => (
            <SceneLine key={node.id} storyId={storyId} node={node} n={i + 1} long={long.has(node.id)} />
          ))}
        </ol>
      )}
      {scenes.length > SHOWN && (
        <button type="button" className={styles.secondary} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `+ ${scenes.length - SHOWN} more`}
        </button>
      )}
    </section>
  );
}

function SceneLine({
  storyId,
  node,
  n,
  long,
}: {
  storyId: string;
  node: StructureNode;
  n: number;
  long: boolean;
}) {
  const { save } = useOutlineActions(storyId);
  const line = sceneLine(node);
  const planned = !node.word_count;
  function commit(value: string) {
    const synopsis = value.trim();
    if (synopsis !== (node.synopsis ?? "").trim()) void save(node.id, { synopsis });
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      e.currentTarget.value = node.synopsis ?? "";
      e.currentTarget.blur();
    }
  }
  const first = line.fromFirstLine ? `“${line.text}”` : "";
  return (
    <li className={styles.scene}>
      <span className={styles.n} aria-hidden>
        {n}
      </span>
      <span className={styles.sceneText}>
        <Link to={`/stories/${storyId}/write/${node.id}`} className={styles.sceneTitle}>
          {node.title || "Untitled"}
        </Link>
        <input
          key={`${node.id}:${node.synopsis}`}
          className={styles.sceneLine}
          defaultValue={node.synopsis}
          placeholder={first || (planned ? "planned, no words yet" : "what happens…")}
          data-first={first ? "" : undefined}
          title={first ? `${first} (${FROM_FIRST_LINE}; type to write your own)` : node.synopsis || undefined}
          aria-label={`What happens in “${node.title || "Untitled"}”${first ? `, now ${FROM_FIRST_LINE}` : ""}`}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={onKey}
        />
        {first && <span className={styles.mark}>{FROM_FIRST_LINE}</span>}
        {long && <span className={styles.long}>{node.word_count.toLocaleString()} words</span>}
      </span>
    </li>
  );
}
