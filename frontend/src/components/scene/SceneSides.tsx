import { openScene } from "../../lib/panel/openScene";
import type { Sequence } from "../../lib/panel/sequence";
import { useFullNode } from "../../lib/panel/useFullNode";
import { neighbourLine } from "../../lib/scene/glance";
import styles from "./SceneSheet.module.css";

/** The scenes either side of a sheet's scene, along its foot: where each leaves off or picks up. */
export default function SceneSides({ sequence }: { sequence: Sequence }) {
  if (!sequence.before && !sequence.after) return null;
  return (
    <nav className={styles.sides} aria-label="The scenes either side">
      {sequence.before ? <Side id={sequence.before.node.id} side="before" /> : <span />}
      {sequence.after && <Side id={sequence.after.node.id} side="after" />}
    </nav>
  );
}

/** A click opens it to write. */
function Side({ id, side }: { id: string; side: "before" | "after" }) {
  const full = useFullNode(id);
  const line = full ? neighbourLine(full, side) : null;
  const title = full?.title ?? "";
  return (
    <button
      type="button"
      className={`${styles.neighbour} ${side === "after" ? styles.after : ""}`}
      onClick={() => openScene(id)}
      title={full ? `Open “${title}” to write` : undefined}
    >
      <span className={styles.sideKicker}>{side === "before" ? "Before this" : "After this"}</span>
      <span className={styles.sideTitle}>{side === "before" ? `← ${title}` : `${title} →`}</span>
      {line && <span className={styles.sideLine}>{line}</span>}
    </button>
  );
}
