import { Link } from "react-router-dom";
import { findRoute, storyPath } from "../../lib/routes";
import type { Finding } from "../../types/findings";
import FindingRow from "./FindingRow";
import styles from "./Findings.module.css";

const SHOWN = 4;

/**
 * The findings about one thing, where the author is looking at it (doc 12 D1, H3): the
 * This scene tab, a Lorebook sheet's Health card. The same rows as the Findings page,
 * without the source badge; past four, a link to the rest.
 */
export default function FindingsCard({
  findings,
  storyId,
  here,
  empty,
}: {
  findings: Finding[];
  storyId: string;
  here?: "scene";
  /** What to say when there is nothing; null says nothing at all. */
  empty: string | null;
}) {
  const route = findRoute("findings");
  if (findings.length === 0) return empty ? <p className={styles.where}>{empty}</p> : null;
  return (
    <div className={styles.card}>
      {findings.slice(0, SHOWN).map((f) => (
        <FindingRow key={f.id} finding={f} here={here} showWhere={false} />
      ))}
      {route && (
        <Link to={storyPath(storyId, route)} className={styles.cardMore}>
          {findings.length > SHOWN
            ? `${findings.length - SHOWN} more, and the rest of the story →`
            : "All findings in the story →"}
        </Link>
      )}
    </div>
  );
}
