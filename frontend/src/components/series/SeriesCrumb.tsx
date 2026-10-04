import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, BookCopy, Plus } from "lucide-react";
import PopoverMenu from "../common/PopoverMenu";
import CreateStoryDialog from "../story/CreateStoryDialog";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import styles from "./SeriesCrumb.module.css";

/**
 * The series in the app bar, before the book's title (series doc): its name opens the
 * series, and the chevron moves to another book or starts the next one. Nothing when the
 * book is a book of its own.
 */
/** `compact` while writing: the scene's breadcrumb needs the room, so the name moves to the tooltip. */
export default function SeriesCrumb({ storyId, compact = false }: { storyId: string; compact?: boolean }) {
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const position = useSeriesStore((s) => s.position);
  const navigate = useNavigate();
  const [sequelTo, setSequelTo] = useState<string | null>(null);
  if (!series) return null;

  const last = series.books[series.books.length - 1];
  return (
    <>
      <span className={styles.crumb}>
        {!compact && <BookCopy size={14} className={styles.icon} aria-hidden />}
        <Link
          to={`/series/${series.id}`}
          className={compact ? styles.iconLink : styles.name}
          title={`The series: ${series.name}`}
          aria-label={compact ? `The series: ${series.name}` : undefined}
        >
          {compact ? <BookCopy size={14} aria-hidden /> : series.name}
        </Link>
        <PopoverMenu
          label={`Books in ${series.name}`}
          trigger={<ChevronDown size={13} />}
          triggerClassName={styles.chevron}
          align="start"
          items={[
            ...series.books.map((b) => ({
              label: `${bookLabel(b.position)}: ${b.title}`,
              icon: BookOpen,
              checked: b.story_id === storyId,
              onSelect: () => navigate(`/stories/${b.story_id}`),
            })),
            { label: "New book in this series", icon: Plus, onSelect: () => setSequelTo(last.story_id) },
          ]}
        />
        <span className={styles.sep} aria-hidden>
          ›
        </span>
        {position !== null && <span className={styles.ordinal}>{bookLabel(position)}</span>}
      </span>
      {sequelTo && <CreateStoryDialog sequelTo={sequelTo} onClose={() => setSequelTo(null)} />}
    </>
  );
}
