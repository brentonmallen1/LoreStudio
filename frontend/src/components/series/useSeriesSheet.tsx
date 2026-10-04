import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink, BookCopy, Unlink } from "lucide-react";
import { seriesApi, type Series, type SeriesKind } from "../../api/series";
import type { MenuItem } from "../common/PopoverMenu";
import { sheetPath } from "../../lib/series/kinds";
import { refreshBookLists } from "../../lib/series/refresh";
import { bookLabel, bookList, elementForRow, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import ElementProgression from "./ElementProgression";
import styles from "./Series.module.css";

/** Which series element a Lorebook sheet shows, when the book is in a series. */
export interface SheetSeries {
  kind: SeriesKind;
  id: string;
}

async function run(fn: () => Promise<Series>, done: string, storyId: string, kind: SeriesKind) {
  try {
    useSeriesStore.getState().accept(await fn());
    await refreshBookLists(storyId, kind);
    toast.success(done);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "That did not work.");
  }
}

/**
 * A Lorebook sheet's part in its series (series doc): the line under the name saying which
 * books the element is in and where this book's version carries on from, the fold showing
 * how it changes book by book, and the ⋯ menu's series actions. Nothing outside a series.
 */
export function useSeriesSheet(
  target: SheetSeries | undefined,
  name: string,
): { line: ReactNode; items: MenuItem[] } {
  const storyId = useSeriesStore((s) => s.storyId);
  const series = useSeriesStore((s) => s.series);
  const position = useSeriesStore((s) => s.position);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!target || !series || !storyId || position === null) return { line: null, items: [] };

  const { kind, id } = target;
  const element = elementForRow(series, storyId, id);
  if (!element)
    return {
      line: null,
      items: [
        {
          label: "Share with the series",
          icon: BookCopy,
          onSelect: () =>
            run(
              () => seriesApi.lift(series.id, kind, storyId, id),
              `${name} is shared with ${series.name}: the other books can bring it in`,
              storyId,
              kind,
            ),
        },
      ],
    };

  const positions = element.members.map((m) => m.position);
  const before = positions.filter((p) => p < position);
  const from = before.length ? Math.max(...before) : null;
  const others = element.members.filter((m) => m.story_id !== storyId);
  const line = (
    <div className={styles.provenance}>
      <div className={styles.provenanceRow}>
        <BookCopy size={13} aria-hidden className={styles.membershipIcon} />
        <span>
          In {bookList(positions)} of {series.name}
          {from !== null ? `; carries on from ${bookLabel(from)}` : others.length ? "; first here" : ""}.
        </span>
        {others.length > 0 && (
          <button className={styles.foldBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
            How {name} changes
          </button>
        )}
      </div>
      {open && <ElementProgression series={series} element={element} here={storyId} />}
    </div>
  );
  const items: MenuItem[] = [
    ...others.map((m) => ({
      label: `Open in ${bookLabel(m.position)}`,
      icon: ExternalLink,
      onSelect: () => navigate(sheetPath(m.story_id, kind, m.ref_id)),
    })),
    {
      label: others.length ? "Not the series' one any more" : "Stop sharing with the series",
      icon: Unlink,
      onSelect: () =>
        run(
          () => seriesApi.removeFromBook(series.id, element.id, storyId),
          `${name} stays in this book as its own`,
          storyId,
          kind,
        ),
    },
  ];
  return { line, items };
}
