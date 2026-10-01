import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { sectionPath } from "../../lib/routes";
import type { StoryHealth } from "../../types";
import styles from "./Findings.module.css";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * The story's numbers above the findings (doc 12 P4): words against the target, scenes by
 * state, threads, goals. Each links to where it is changed. They move to the Overview in
 * P6; until then they live here, so retiring Story Health loses none of them.
 */
export default function Vitals({ storyId }: { storyId: string }) {
  const [health, setHealth] = useState<StoryHealth | null>(null);
  const load = () => api.getStoryHealth(storyId).then(setHealth);
  useEffect(() => {
    void load().catch(() => {});
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnUndo(["structure_node", "plot_thread", "story"], load);
  if (!health) return null;

  const target = health.word_count.target;
  const byStatus = health.scenes.by_status;
  const states = (["draft", "revised", "final"] as const)
    .filter((s) => byStatus[s])
    .map((s) => `${byStatus[s]} ${s}`)
    .join(" · ");
  const open = health.threads.open.length + health.threads.developing.length;
  const items = [
    {
      label: "Words",
      value: health.word_count.total.toLocaleString(),
      sub: target ? `${Math.round(target.pct)}% of ${target.max.toLocaleString()}` : "no target length",
      to: sectionPath(storyId, "lorebook", "identity"),
    },
    {
      label: "Scenes",
      value: String(health.scenes.total),
      sub: states || "none written",
      to: `/stories/${storyId}/write`,
    },
    {
      label: "Threads",
      value: `${open} open`,
      sub: health.threads.resolved.length
        ? `${plural(health.threads.resolved.length, "resolved", "resolved")}`
        : "none resolved yet",
      to: sectionPath(storyId, "lorebook", "threads"),
    },
    {
      label: "Goals",
      value: `${health.goals.done} of ${health.goals.total}`,
      sub: health.goals.total ? "met" : "none set",
      to: sectionPath(storyId, "lorebook", "identity"),
    },
  ];
  return (
    <nav className={styles.vitals} aria-label="The story in numbers">
      {items.map((v) => (
        <Link key={v.label} to={v.to} className={styles.vital}>
          <span className={styles.vitalLabel}>{v.label}</span>
          <span className={styles.vitalValue}>{v.value}</span>
          <span className={styles.vitalSub}>{v.sub}</span>
        </Link>
      ))}
    </nav>
  );
}
