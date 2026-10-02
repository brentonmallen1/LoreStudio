import { Link } from "react-router-dom";
import { ListTree, PenLine, Users, NotebookPen } from "lucide-react";
import styles from "./Overview.module.css";

/** A story with nothing in it yet: four ways in. */
export default function StartPaths({ storyId }: { storyId: string }) {
  const paths = [
    {
      to: `/stories/${storyId}/write`,
      icon: PenLine,
      name: "Write a scene",
      hint: "Jump straight in. Add structure, characters and details as you go.",
    },
    {
      to: `/stories/${storyId}/freewrite`,
      icon: NotebookPen,
      name: "Start from an idea",
      hint: "Write whatever you know, in any order. Make sentences into characters, places and notes as they come.",
    },
    {
      to: `/stories/${storyId}/lorebook/characters`,
      icon: Users,
      name: "Build your cast",
      hint: "Create characters first. Give them roles, interview them, then write.",
    },
    {
      to: `/stories/${storyId}/plan`,
      icon: ListTree,
      name: "Plan it out",
      hint: "A few small questions in order: one sentence, who wants what, then the scenes.",
    },
  ];
  return (
    <section className={styles.start} aria-label="Where would you like to start?">
      <p className={styles.startLabel}>Where would you like to start?</p>
      <div className={styles.startPaths}>
        {paths.map(({ to, icon: Icon, name, hint }) => (
          <Link key={name} to={to} className={styles.startPath}>
            <Icon size={15} className={styles.startIcon} aria-hidden />
            <span className={styles.startName}>{name}</span>
            <span className={styles.startHint}>{hint}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
