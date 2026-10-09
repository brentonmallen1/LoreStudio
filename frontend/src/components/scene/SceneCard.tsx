import { Link } from "react-router-dom";
import { PenLine } from "lucide-react";
import { openScene } from "../../lib/panel/openScene";
import type { Sequence } from "../../lib/panel/sequence";
import { useFullNode } from "../../lib/panel/useFullNode";
import { neighbourLine } from "../../lib/scene/glance";
import { useSceneFacts } from "../../lib/scene/useSceneFacts";
import type { Story, StructureNode } from "../../types";
import SheetField from "./SheetField";
import styles from "./SceneSheet.module.css";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

type Field = "synopsis" | "entry_state" | "exit_state";

/**
 * The Scene sheet's index card (doc 24 D19, canvas 8d): the third of the page that stays in
 * view. What happens and the turn, in the author's words and editable here; who, where, which
 * beat and when, read at a glance (a click opens the page that edits them); Write; and the
 * scenes either side.
 */
export default function SceneCard({
  node,
  story,
  sequence,
  povName,
  save,
  onFacts,
  refresh,
}: {
  node: StructureNode;
  story: Story;
  sequence: Sequence | null;
  povName?: string;
  save: (field: Field) => (value: string) => Promise<unknown>;
  /** Open the page that edits who, where and when. */
  onFacts: () => void;
  /** Changes when the places may have changed, to read them again. */
  refresh: unknown;
}) {
  const { who, where, beat, when } = useSceneFacts(node, story, refresh);
  const words = node.word_count ?? 0;

  return (
    <aside className={styles.card} aria-label="The scene">
      <p className={styles.kicker}>
        <span className={styles[`status_${node.status}`]}>{STATUS_LABEL[node.status] ?? node.status}</span>
        {sequence && ` · Scene ${sequence.position} of ${sequence.total}`}
        {` · ${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}
      </p>
      <h1 className={styles.title}>{node.title}</h1>

      <SheetField
        key={`${node.id}:synopsis`}
        label="What happens"
        prose
        initial={node.synopsis ?? ""}
        placeholder="What happens in this scene, in a sentence or two…"
        save={save("synopsis")}
      />

      <div className={styles.turn}>
        <SheetField
          key={`${node.id}:entry`}
          label="Coming in"
          initial={node.entry_state ?? ""}
          placeholder={`Who is ${povName ?? "your point-of-view character"} before this scene begins?`}
          save={save("entry_state")}
        />
        <SheetField
          key={`${node.id}:exit`}
          label="Going out"
          initial={node.exit_state ?? ""}
          placeholder="How has the character or situation changed by the end?"
          save={save("exit_state")}
        />
      </div>

      <button
        type="button"
        className={styles.glanceFacts}
        onClick={onFacts}
        title="Change who, where, the beat or when"
      >
        <span className={styles.factName}>Who</span>
        <span>
          {who.length ? (
            who.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <br />}
                {p.name}
                {p.pov && <span className={styles.muted}> POV</span>}
              </span>
            ))
          ) : (
            <span className={styles.muted}>No one yet</span>
          )}
        </span>
        <span className={styles.factName}>Where</span>
        <span>
          {where.length ? (
            where.map((p, i) => (
              <span key={p.name} className={p.role === "primary" ? undefined : styles.muted}>
                {i > 0 && " · "}
                {p.role === "primary" ? p.name : `${p.role} ${p.name}`}
              </span>
            ))
          ) : (
            <span className={styles.muted}>Not set</span>
          )}
        </span>
        <span className={styles.factName}>Beat</span>
        <span className={beat ? undefined : styles.muted}>
          {beat ? `${beat.position_pct}% · ${beat.name}` : "None"}
        </span>
        <span className={styles.factName}>When</span>
        <span className={when ? undefined : styles.muted}>{when ?? "Not set"}</span>
      </button>

      <Link to={`/stories/${story.id}/write/${node.id}`} className={styles.write}>
        <PenLine size={14} aria-hidden /> Write this scene
      </Link>

      {sequence && (sequence.before || sequence.after) && (
        <nav className={styles.sides} aria-label="The scenes either side">
          {sequence.before && <Side id={sequence.before.node.id} side="before" />}
          {sequence.after && <Side id={sequence.after.node.id} side="after" />}
        </nav>
      )}
    </aside>
  );
}

/** A scene either side, with where it leaves off or picks up; a click opens it to write. */
function Side({ id, side }: { id: string; side: "before" | "after" }) {
  const full = useFullNode(id);
  const line = full ? neighbourLine(full, side) : null;
  const title = full?.title ?? "";
  return (
    <button
      type="button"
      className={styles.side}
      onClick={() => openScene(id)}
      title={full ? `Open “${title}” to write` : undefined}
    >
      <span className={styles.sideTitle}>{side === "before" ? `← ${title}` : `${title} →`}</span>
      {line && <span className={styles.sideLine}>{line}</span>}
    </button>
  );
}
