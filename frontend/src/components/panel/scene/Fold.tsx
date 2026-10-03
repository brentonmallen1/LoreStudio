import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useFoldOpen } from "../../../lib/panel/fold";
import styles from "./SceneSequence.module.css";

/**
 * One folded section of the This scene tab, with a count where it has one ("Notes 2").
 * Open or shut is remembered, so it stays the same as the author moves between scenes.
 */
export default function Fold({
  id,
  title,
  count,
  defaultOpen = false,
  flush = false,
  className,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  /** The body pads itself. */
  flush?: boolean;
  /** The title's colour, for the Assistant's fold. */
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useFoldOpen(id, defaultOpen);
  return (
    <section className={styles.fold}>
      <button type="button" className={styles.foldHead} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronRight size={13} className={open ? styles.chevronOpen : styles.chevron} aria-hidden />
        <span className={`${styles.foldTitle} ${className ?? ""}`}>{title}</span>
        {count !== undefined && <span className={styles.foldCount}>{count}</span>}
      </button>
      {open && <div className={flush ? styles.foldBodyFlush : styles.foldBody}>{children}</div>}
    </section>
  );
}
