import { useEffect, useState, type RefObject } from "react";
import { usePanelStore } from "../../stores/panelStore";
import { entityColor } from "../panel/entityColor";
import styles from "./SceneEditor.module.css";

/**
 * A thin strip beside the prose marking every paragraph that names the highlighted entity
 * (doc 11 P2), so you can see at a glance where in the scene they are. The mentions
 * themselves are lit by the decoration plugin (`mention-hl`); this only reads where they
 * are. It never touches ProseMirror's DOM: a class toggled on a decoration span makes
 * ProseMirror redraw it, and an observer watching that redraw would loop forever.
 */
export default function MentionGutter({
  scrollAreaRef,
}: {
  scrollAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const highlight = usePanelStore((s) => s.highlight);
  const [marks, setMarks] = useState<{ top: number; height: number }[]>([]);
  const [color, setColor] = useState<string>("transparent");

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const prose = area.querySelector<HTMLElement>(".ProseMirror");
    if (!prose || !highlight) {
      setMarks([]);
      return;
    }
    let frame = 0;

    function measure() {
      if (!area || !prose) return;
      const spans = prose.querySelectorAll<HTMLElement>(".mention-hl:not(.mention-syntax)");
      const paragraphs = new Set<HTMLElement>();
      spans.forEach((el) => {
        const p = el.closest<HTMLElement>(".ProseMirror > *");
        if (p) paragraphs.add(p);
      });
      const areaTop = area.getBoundingClientRect().top;
      setMarks(
        [...paragraphs].map((p) => {
          const r = p.getBoundingClientRect();
          return { top: r.top - areaTop + area.scrollTop, height: Math.max(6, r.height) };
        }),
      );
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    setColor(entityColor(highlight.kind, highlight.id));
    schedule();
    // The prose changes shape as the author types; keep the marks where the paragraphs are.
    const observer = new MutationObserver(schedule);
    observer.observe(prose, { childList: true, subtree: true, characterData: true, attributes: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(prose);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      ro.disconnect();
    };
  }, [highlight, scrollAreaRef]);

  if (!highlight || marks.length === 0) return null;
  return (
    <div className={styles.mentionGutter} aria-hidden="true">
      {marks.map((m, i) => (
        <span
          key={i}
          className={styles.mentionGutterMark}
          style={{ top: m.top, height: m.height, background: color }}
        />
      ))}
    </div>
  );
}
