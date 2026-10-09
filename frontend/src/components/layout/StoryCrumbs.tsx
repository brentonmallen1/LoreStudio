import { useMemo, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookCopy, BookOpen, Plus, Undo2 } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import CreateStoryDialog from "../story/CreateStoryDialog";
import { buildTrail, type CrumbChild, type CrumbMark } from "../../lib/crumbs/trail";
import { useAIAvailable, useMode } from "../../lib/mode";
import { sceneToResume } from "../../lib/resumeScene";
import { useColourContext, useStripLine } from "../../lib/strip/useColourContext";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import styles from "./StoryCrumbs.module.css";

/** A crumb's colour: an entity's slot dot, a chapter's pips, a scene's status shape. */
function Mark({ mark }: { mark?: CrumbMark }) {
  if (!mark) return null;
  if (mark.kind === "dot")
    return <span className={styles.dot} style={{ background: mark.color }} aria-hidden />;
  if (mark.kind === "pips")
    return (
      <span className={styles.pips} aria-hidden>
        {mark.colors.map((c) => (
          <span key={c} className={styles.pip} style={{ background: c }} />
        ))}
      </span>
    );
  return (
    <span
      className={styles.stop}
      data-shape={mark.shape}
      style={mark.color ? ({ "--stop-color": mark.color } as CSSProperties) : undefined}
      aria-hidden
    />
  );
}

/**
 * Where you are, on every story page (doc 24 P5, D15): `Series › Book › Page › Section ›
 * Entry`, or while writing `Book › Act › Chapter › Scene`. The words go to that place; the
 * › after a crumb opens what is inside it. Chapters carry the strip's colour pips and scenes
 * their status shape, in the strip's current colour mode. Away from the prose, the way back
 * to the scene you were writing ends the trail.
 */
export default function StoryCrumbs({ storyId }: { storyId: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const storyTitle = useStoryStore((s) => s.activeStory?.title ?? "");
  const activeNode = useStoryStore((s) => s.activeNode);
  const structure = useStoryStore((s) => s.structure);
  const characters = useStoryStore((s) => s.characters);
  const locations = useStoryStore((s) => s.locations);
  const threads = useStoryStore((s) => s.threads);
  const colourMode = useUIStore((s) => s.stripColourMode);
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const ctx = useColourContext();
  const line = useStripLine();
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const [sequelTo, setSequelTo] = useState<string | null>(null);

  const rest = pathname.replace(/^\/stories\/[^/]+/, "");
  const writing = /^\/write(\/|$)/.test(rest);
  const nodeId = rest.match(/^\/write\/([^/]+)/)?.[1] ?? (writing ? (activeNode?.id ?? null) : null);

  const trail = useMemo(
    () =>
      buildTrail({
        storyId,
        storyTitle,
        rest,
        mode,
        aiAvailable,
        nodeId,
        structure,
        line,
        colourMode,
        ctx,
        characters,
        locations,
        threads,
      }),
    [
      storyId,
      storyTitle,
      rest,
      mode,
      aiAvailable,
      nodeId,
      structure,
      line,
      colourMode,
      ctx,
      characters,
      locations,
      threads,
    ],
  );

  // Away from the prose, the way back to the scene you were writing. The Overview's own
  // hero says where to carry on, so it does not offer a second answer here (doc 14 review).
  const back =
    writing || rest === "" || rest === "/"
      ? null
      : activeNode && activeNode.story_id === storyId
        ? activeNode
        : sceneToResume(storyId, structure, null);

  const item = (c: CrumbChild): MenuItem => ({
    key: c.key,
    label: c.label,
    icon: c.icon,
    group: c.group,
    current: c.current,
    // A chapter's pips sit at the row's end, as in the strip's key; a dot or a stop leads.
    marker: c.mark && c.mark.kind !== "pips" ? <Mark mark={c.mark} /> : undefined,
    hint: c.mark?.kind === "pips" ? <Mark mark={c.mark} /> : c.hint,
    onSelect: () => navigate(c.to),
  });

  const last = series ? series.books[series.books.length - 1] : null;
  return (
    <nav aria-label="Where you are" className={styles.trail}>
      <ol className={styles.list}>
        {series && (
          <li className={styles.crumb}>
            <Link
              to={`/series/${series.id}`}
              className={`${styles.link} ${writing ? styles.linkIcon : ""}`}
              title={`The series: ${series.name}`}
              aria-label={writing ? `The series: ${series.name}` : undefined}
            >
              <BookCopy size={14} className={styles.seriesIcon} aria-hidden />
              {!writing && <span className={styles.label}>{series.name}</span>}
            </Link>
            <PopoverMenu
              label={`Books in ${series.name}`}
              trigger={<span aria-hidden>›</span>}
              triggerClassName={styles.sep}
              align="start"
              items={[
                ...series.books.map((b) => ({
                  key: b.story_id,
                  label: `${bookLabel(b.position)}: ${b.title}`,
                  icon: BookOpen,
                  current: b.story_id === storyId,
                  onSelect: () => navigate(`/stories/${b.story_id}`),
                })),
                ...(last
                  ? [
                      {
                        label: "New book in this series",
                        icon: Plus,
                        quiet: true,
                        onSelect: () => setSequelTo(last.story_id),
                      },
                    ]
                  : []),
              ]}
            />
          </li>
        )}
        {trail.map((c, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={c.key} className={styles.crumb}>
              <Link
                to={c.to}
                className={[
                  styles.link,
                  c.kind === "book" ? styles.book : "",
                  isLast ? styles.current : "",
                ].join(" ")}
                aria-current={isLast ? "page" : undefined}
                title={c.label}
              >
                <Mark mark={c.mark} />
                <span className={styles.label}>{c.label}</span>
              </Link>
              {c.children.length > 0 ? (
                <PopoverMenu
                  label={c.menuLabel}
                  trigger={<span aria-hidden>›</span>}
                  triggerClassName={styles.sep}
                  align="start"
                  items={c.children.map(item)}
                />
              ) : (
                !isLast && (
                  <span className={styles.sepPlain} aria-hidden>
                    ›
                  </span>
                )
              )}
            </li>
          );
        })}
      </ol>
      {back && (
        <Link
          to={`/stories/${storyId}/write/${back.id}`}
          className={styles.back}
          title={`Back to ${back.title}`}
          aria-label={`Back to ${back.title}`}
        >
          <Undo2 size={14} aria-hidden />
          <span className={styles.label}>{back.title}</span>
        </Link>
      )}
      {sequelTo && <CreateStoryDialog sequelTo={sequelTo} onClose={() => setSequelTo(null)} />}
    </nav>
  );
}
