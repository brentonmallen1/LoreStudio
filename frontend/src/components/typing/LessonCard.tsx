import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { StructureNode } from "../../types";
import { sceneLeaves } from "../../lib/planning/methods";
import type { HelperId } from "../../lib/typing/helpers";
import { useStoryStore } from "../../stores/storyStore";
import { lessonText, type Lesson } from "../../lib/typing/lesson";
import Practice from "./Practice";
import { useTried } from "./useTried";
import styles from "./LessonCard.module.css";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function keep(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* site data blocked: it lasts as long as the page */
  }
}

/**
 * The lesson card above a tutorial scene (doc 26, P6; option A on the canvas): which lesson
 * it is, what it teaches, things to try below that tick as they are done, and the next lesson.
 * It folds away to a line, and stays folded for the story; what was tried is kept per scene,
 * on this device.
 */
export default function LessonCard({ node, lesson }: { node: StructureNode; lesson: Lesson }) {
  const foldKey = `ls_lesson_folded:${node.story_id}`;
  const triedKey = `ls_lesson_tried:${node.id}`;
  const [folded, setFolded] = useState(() => read(foldKey, false));
  const now = useTried(node.id);
  const [before] = useState<HelperId[]>(() => read(triedKey, []));
  const tried = new Set<HelperId>([...before, ...now]);
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const leaves = sceneLeaves(structure, template);
  const next = leaves[leaves.findIndex((s) => s.id === node.id) + 1];
  const count = lesson.practice.filter((p) => tried.has(p.id)).length;

  useEffect(() => {
    if (now.size) keep(triedKey, [...new Set([...read<HelperId[]>(triedKey, []), ...now])]);
  }, [now, triedKey]);

  function fold(to: boolean) {
    setFolded(to);
    keep(foldKey, to);
  }

  const head = `Lesson ${lesson.number} of ${lesson.of} · ${lesson.topic}`;
  if (folded)
    return (
      <button type="button" className={styles.folded} onClick={() => fold(false)} aria-expanded={false}>
        <span>{head}</span>
        <span className={styles.foldedTitle}>{node.title}</span>
        {lesson.practice.length > 0 && (
          <span className={styles.count}>{`${count} of ${lesson.practice.length} tried`}</span>
        )}
        <ChevronDown size={13} aria-hidden />
      </button>
    );

  return (
    <section className={styles.card} aria-label="Lesson">
      <div className={styles.top}>
        <span className={styles.head}>{head}</span>
        <button type="button" className={styles.fold} onClick={() => fold(true)} aria-expanded>
          Fold away
        </button>
      </div>
      <h2 className={styles.title}>{node.title}</h2>
      <p className={styles.text}>{lessonText(lesson.text)}</p>
      {lesson.practice.length > 0 && (
        <Practice steps={lesson.practice} tried={tried} title="Try it below" showCount={false} />
      )}
      <div className={styles.foot}>
        <span className={styles.count}>
          {lesson.practice.length > 0 ? `${count} of ${lesson.practice.length} tried` : ""}
        </span>
        {next && (
          <Link to={`/stories/${node.story_id}/write/${next.id}`} className={styles.next}>
            Next: {next.title} →
          </Link>
        )}
      </div>
    </section>
  );
}
