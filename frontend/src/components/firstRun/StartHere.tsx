import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { countWord, startHereDone, startHereStory, tutorialOutline } from "../../lib/firstRun/startHere";
import { useAuthStore } from "../../stores/authStore";
import type { Story } from "../../types";
import styles from "./StartHere.module.css";

const SHOWN = 3;

/**
 * "Start here" on the Dashboard (doc 30 D4): the tutorial's lesson 1, for an account that has
 * the tutorial and has not opened it. It opens lesson 1 itself, never the scene edited last,
 * and goes once used, put away, or the tutorial is opened some other way.
 */
export default function StartHere({ stories }: { stories: Story[] }) {
  const settings = useAuthStore((s) => s.user?.settings);
  const id = startHereStory(settings);
  const here = id ? stories.some((s) => s.id === id) : false;
  const [outline, setOutline] = useState<ReturnType<typeof tutorialOutline> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id || !here) return;
    let live = true;
    api
      .getStructure(id)
      .then((nodes) => live && setOutline(tutorialOutline(nodes)))
      .catch(() => live && setOutline(null));
    return () => {
      live = false;
    };
  }, [id, here]);

  if (!id || !here || !outline) return null;
  const { topics, lessons, first } = outline;

  function open() {
    void startHereDone();
    navigate(first ? `/stories/${id}/write/${first}` : `/stories/${id}/write`);
  }

  return (
    <section className={styles.card} aria-labelledby="start-here-title">
      <span className={styles.kicker}>Start here</span>
      <h2 id="start-here-title" className={styles.title}>
        Learn LoreStudio in {countWord(lessons)} short lessons
      </h2>
      <p className={styles.text}>
        Each lesson is a scene you can type into, {countWord(topics.length)} topics in all. Start with lesson
        1; take them in any order after that.
      </p>
      <ol className={styles.topics}>
        {topics.slice(0, SHOWN).map((t, i) => (
          <li key={t} className={styles.topic} data-first={i === 0 || undefined}>
            <span className={styles.number} aria-hidden>
              {i + 1}
            </span>
            {t}
          </li>
        ))}
        {topics.length > SHOWN && (
          <li className={`${styles.topic} ${styles.more}`}>
            <span className={styles.number} aria-hidden>
              …
            </span>
            {topics.length - SHOWN} more topics
          </li>
        )}
      </ol>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={open}>
          Open lesson 1
        </button>
        <button type="button" className={styles.ghost} onClick={() => void startHereDone()}>
          Skip, start my own story
        </button>
      </div>
    </section>
  );
}
