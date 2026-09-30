import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import ColumnNavigator from "./ColumnNavigator";
import { pathTo } from "./structureTreeMeta";
import styles from "./BreadcrumbNav.module.css";

/**
 * Where you are in the book, in the header (refactor doc 11, phase 3): act › chapter ›
 * scene, each a link to that node's page, and a chevron that opens the column navigator
 * for jumping anywhere while the strip stays collapsed.
 */
export default function BreadcrumbNav() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { structure, activeNode } = useStoryStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trail = activeNode ? (pathTo(structure, activeNode.id) ?? []) : [];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!storyId || structure.length === 0) return null;
  return (
    <div ref={ref} className={styles.wrap}>
      <nav aria-label="Where you are" className={styles.crumbs}>
        {trail.map((n, i) => (
          <span key={n.id} className={styles.crumb}>
            <span className={styles.sep}>›</span>
            <button
              className={`${styles.crumbBtn} ${i === trail.length - 1 ? styles.crumbCurrent : ""}`}
              onClick={() => navigate(`/stories/${storyId}/write/${n.id}`)}
              title={n.title}
            >
              {n.title}
            </button>
          </span>
        ))}
        <button
          className={styles.chevron}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Go to a scene"
          title="Go to a scene"
        >
          <ChevronDown size={13} />
        </button>
      </nav>
      {open && <ColumnNavigator storyId={storyId} onClose={() => setOpen(false)} />}
    </div>
  );
}
