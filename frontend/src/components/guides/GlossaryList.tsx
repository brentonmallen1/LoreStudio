import { GLOSSARY_GROUPS, entriesFor } from "../../lib/glossary";
import { useMode } from "../../lib/mode";
import InlineText from "../common/InlineText";
import styles from "./GlossaryList.module.css";

/**
 * One group of the glossary, drawn where glossary.md says `<!-- terms:<group> -->`, from the
 * entries `Term` reads too (doc 30 D1). Each entry is an anchor, so a popover's "More in the
 * glossary" lands on it.
 */
export default function GlossaryList({ group }: { group: string }) {
  const mode = useMode();
  const found = GLOSSARY_GROUPS.find((g) => g.id === group);
  if (!found) return null;
  return (
    <dl className={styles.list}>
      {entriesFor(found, mode).map((e) => (
        <div key={e.id} id={e.id} className={styles.entry}>
          <dt className={styles.term}>{e.term}</dt>
          <dd className={styles.definition}>
            <span>
              <InlineText text={e.definition} />
            </span>
            {e.example && (
              <span className={styles.example}>
                <span className={styles.exampleLabel}>From The Last Lighthouse: </span>
                {e.example}
              </span>
            )}
            {e.alsoCalled && e.alsoCalled.length > 0 && (
              <span className={styles.also}>Also called: {e.alsoCalled.join(", ")}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
