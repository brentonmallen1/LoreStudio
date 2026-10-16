import { ChevronDown } from "lucide-react";
import { useEditorBridge } from "../../../stores/editorBridge";
import { useStoryStore } from "../../../stores/storyStore";
import { takeName, useTakesStore } from "../../../stores/takesStore";
import PopoverMenu from "../../common/PopoverMenu";
import styles from "./Takes.module.css";

/**
 * The scene's takes in its header (doc 29 D7): one pill a take, the open one pressed and the one
 * that counts ticked, then "+ Try another version", the open take's Use this take, and Compare;
 * where the editor is narrow, one pill (the open take) with all of that in its menu. Renaming and
 * deleting the open take are in the scene's ⋯. Shown only while the scene has more
 * than one take: with one, Try another version waits in the scene's ⋯, and the header stays quiet.
 */
export default function TakeSwitcher() {
  const nodeId = useStoryStore((s) => s.activeNode?.id);
  const { takes, comparing } = useTakesStore();
  const forNode = useTakesStore((s) => s.nodeId === nodeId);
  const bridge = useEditorBridge((s) => s.takes);
  if (!bridge || !forNode || takes.length < 2) return null;
  const open = takes.find((t) => t.is_open) ?? takes[0];
  return (
    <div className={styles.switcher}>
      <div className={styles.tabs} role="tablist" aria-label="Takes of this scene">
        {takes.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.is_open}
            aria-label={`${takeName(t)}${t.counts ? ", the one that counts" : ""}`}
            className={styles.tab}
            title={`${takeName(t)}, ${t.word_count.toLocaleString()} words${t.counts ? ". The one that counts: it is the scene in your manuscript, exports and checks" : ""}`}
            onClick={() => !t.is_open && bridge.switchTo(t.id)}
          >
            <span className={styles.tabName}>{takeName(t)}</span>
            {t.counts && (
              <span className={styles.tick} aria-hidden>
                ✓
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className={styles.tab}
          onClick={bridge.tryAnother}
          title="A copy of this take to change as you like; the one that counts stays as it is"
          aria-label="Try another version"
        >
          <span aria-hidden>+</span>
          <span>Try another version</span>
        </button>
      </div>
      <div className={styles.compact}>
        <PopoverMenu
          label={`Takes of this scene: ${takeName(open)} is open${open.counts ? ", the one that counts" : ""}`}
          triggerClassName={styles.compactTrigger}
          align="end"
          trigger={
            <>
              <span className={styles.tabName}>{takeName(open)}</span>
              {open.counts && <span aria-hidden>✓</span>}
              <ChevronDown size={12} aria-hidden />
            </>
          }
          items={[
            ...takes.map((t) => ({
              key: t.id,
              label: takeName(t),
              current: t.is_open,
              hint: t.counts ? "✓ counts" : undefined,
              onSelect: () => !t.is_open && bridge.switchTo(t.id),
            })),
            ...(open.counts ? [] : [{ label: "Use this take", onSelect: () => bridge.use(open.id) }]),
            {
              label: comparing ? "Back to writing" : "Compare takes",
              onSelect: () => bridge.compare(!comparing),
            },
            { label: "+ Try another version", quiet: true, onSelect: bridge.tryAnother },
          ]}
        />
      </div>
      {!open.counts && (
        <span className={styles.wide}>
          <button type="button" className={styles.action} onClick={() => bridge.use(open.id)}>
            Use this take
          </button>
        </span>
      )}
      <span className={styles.wide}>
        <button
          type="button"
          className={styles.action}
          aria-pressed={comparing}
          onClick={() => bridge.compare(!comparing)}
          title="Two takes side by side, the words that differ marked"
        >
          Compare
        </button>
      </span>
    </div>
  );
}
