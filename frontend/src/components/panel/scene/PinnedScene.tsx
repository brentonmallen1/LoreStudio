import { Pin, X } from "lucide-react";
import { openScene } from "../../../lib/panel/openScene";
import { excerpt, proseParagraphs, sceneSequence } from "../../../lib/panel/sequence";
import { useFullNode } from "../../../lib/panel/useFullNode";
import { usePanelStore } from "../../../stores/panelStore";
import { useStoryStore } from "../../../stores/storyStore";
import styles from "./SceneSequence.module.css";

const STATUS: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

/**
 * A scene further away, pinned on top of the This scene tab by ⌥-clicking it on the strip.
 * Read-only and temporary: the open scene stays right below it, so nothing switches and
 * there is no way back to find. "Open to write" goes there and lets go of the pin.
 */
export default function PinnedScene({ id }: { id: string }) {
  const node = useFullNode(id);
  const amount = usePanelStore((s) => s.proseAmount);
  const pinScene = usePanelStore((s) => s.pinScene);
  const { structure, activeTemplate } = useStoryStore();
  const chapter = sceneSequence(structure, activeTemplate, id)?.chapter;

  const paragraphs = node ? proseParagraphs(node.content) : [];
  const ending = excerpt(paragraphs, amount, "end");
  const words = node?.word_count ?? 0;

  return (
    <section className={styles.pinned} aria-label={`Pinned: ${node?.title ?? "scene"}`}>
      <div className={styles.pinnedHead}>
        <Pin size={12} aria-hidden />
        <span className={styles.pinnedKicker}>Pinned from the strip</span>
        <button
          type="button"
          className={styles.unpin}
          onClick={() => pinScene(null)}
          aria-label={`Unpin ${node?.title ?? "this scene"}`}
          title="Unpin"
        >
          <X size={13} />
        </button>
      </div>
      {!node ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          <div>
            <h3 className={styles.hereTitle}>{node.title}</h3>
            <p className={styles.hereMeta}>
              {[chapter, STATUS[node.status] ?? node.status, `${words.toLocaleString()} words`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {node.synopsis && <p className={styles.pinnedText}>{node.synopsis}</p>}
          {node.purpose && (
            <div className={styles.fact}>
              <span className={styles.factLabel}>Purpose</span>
              <p>{node.purpose}</p>
            </div>
          )}
          <div className={styles.fact}>
            <span className={styles.factLabel}>How it ends</span>
            {ending.length > 0 ? (
              <div className={styles.prose}>
                {paragraphs.length > ending.length && <p className={styles.cut}>…</p>}
                {ending.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>Not written yet.</p>
            )}
          </div>
          <div>
            <button
              type="button"
              className={styles.openBtn}
              onClick={() => {
                pinScene(null);
                openScene(node.id);
              }}
            >
              Open to write
            </button>
          </div>
        </>
      )}
    </section>
  );
}
