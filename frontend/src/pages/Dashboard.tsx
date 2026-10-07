import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Clock,
  FileInput,
  Trash2,
  ArrowRight,
  BookPlus,
  BookCopy,
  LayoutGrid,
  List,
} from "lucide-react";
import { api } from "../api/client";
import { progressApi, type StoryProgress } from "../api/progress";
import { seriesApi, type SeriesSummary } from "../api/series";
import { dashboardSegments } from "../lib/series/dashboard";
import { bookLabel } from "../stores/seriesStore";
import { useAuthStore } from "../stores/authStore";
import { useStoryStore } from "../stores/storyStore";
import { formatRelative } from "../lib/utils";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import NewSeriesDialog from "../components/series/NewSeriesDialog";
import SeriesGroup from "../components/series/SeriesGroup";
import { seriesPath } from "../lib/series/sections";
import ImportWizard from "../components/import/ImportWizard";
import StoryListRow from "../components/story/StoryListRow";
import list from "../components/story/StoryList.module.css";
import type { Story } from "../types";
import styles from "./Dashboard.module.css";

type Layout = "cards" | "list";
const LAYOUT_KEY = "ls_dashboard_layout";

/** Cards or a list, as this browser last left it. */
function savedLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { stories, setStories, removeStory } = useStoryStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  // The book a new one follows, when "Write a sequel" or a series' "New book" opened the dialog.
  // "Write a sequel to this book" from the palette arrives as ?sequel=<story>.
  const [sequelTo, setSequelTo] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("sequel"),
  );
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>([]);
  // Jobs › Open on a finished import reading comes back here with ?import (doc 21 R8).
  const [importing, setImporting] = useState(() => new URLSearchParams(window.location.search).has("import"));
  // "New series" from the palette arrives as ?newSeries=1.
  const [newSeries, setNewSeries] = useState(() =>
    new URLSearchParams(window.location.search).has("newSeries"),
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Words, progress toward the target and the scene to continue in, per story.
  const [progress, setProgress] = useState<Record<string, StoryProgress>>({});
  const [layout, setLayoutState] = useState<Layout>(savedLayout);
  function setLayout(next: Layout) {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Site data blocked: it still switches, it just forgets.
    }
  }

  useEffect(() => {
    progressApi
      .list()
      .then((rows) => setProgress(Object.fromEntries(rows.map((r) => [r.story_id, r]))))
      .catch(() => {});
  }, [stories.length]);

  useEffect(() => {
    seriesApi
      .list()
      .then(setSeriesList)
      .catch(() => {});
  }, [stories.length]);
  const segments = useMemo(() => dashboardSegments(stories, seriesList), [stories, seriesList]);

  // Fetched on every visit: the list is small, and a cached one showed stale "updated"
  // times and order after an evening of writing.
  useEffect(() => {
    api.listStories().then(setStories).catch(console.error);
  }, [setStories]);

  async function confirmDelete(story: Story, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDeleteId(story.id);
  }

  async function doDelete(story: Story, e?: React.MouseEvent) {
    e?.stopPropagation();
    setPendingDeleteId(null);
    setDeletingId(story.id);
    await api.deleteStory(story.id);
    removeStory(story.id);
    setDeletingId(null);
  }

  /** A run of stories, as cards or as a list; `ordinal` gives a book its place in its series. */
  function renderStories(rows: Story[], ordinal?: (story: Story) => number | undefined, series = false) {
    if (layout === "list")
      return (
        <ul className={list.list}>
          {rows.map((story) => (
            <StoryListRow
              key={story.id}
              story={story}
              ordinal={ordinal?.(story)}
              progress={progress[story.id]}
              deleting={deletingId === story.id}
              onOpen={() => navigate(`/stories/${story.id}`)}
              onContinue={() =>
                navigate(`/stories/${story.id}/write?node=${progress[story.id]?.last_scene_id}`)
              }
              onSequel={() => setSequelTo(story.id)}
              onDelete={() => void doDelete(story)}
            />
          ))}
        </ul>
      );
    return (
      <div className={series ? `${styles.grid} ${styles.seriesGrid}` : styles.grid}>
        {rows.map((story) => renderCard(story, ordinal?.(story)))}
      </div>
    );
  }

  /** One story's card; `ordinal` is its place in its series, when it has one. */
  function renderCard(story: Story, ordinal?: number) {
    return (
      <div key={story.id} className={styles.storyCardWrap}>
        <button
          onClick={() => navigate(`/stories/${story.id}`)}
          className={styles.storyCard}
          aria-label={`Open ${story.title}`}
        >
          {ordinal !== undefined && <span className={styles.ordinal}>{bookLabel(ordinal)}</span>}
          <h3 className={styles.storyTitle}>{story.title}</h3>
          {story.description && <p className={styles.storyDesc}>{story.description}</p>}
          <StoryProgressLine progress={progress[story.id]} />
          <div className={styles.storymeta}>
            <Clock size={11} />
            {formatRelative(story.updated_at)}
          </div>
        </button>
        {progress[story.id]?.last_scene_id && (
          <button
            className={styles.continueLink}
            onClick={() => navigate(`/stories/${story.id}/write?node=${progress[story.id].last_scene_id}`)}
            title={`Continue writing “${progress[story.id].last_scene_title}”`}
          >
            Continue <ArrowRight size={12} />
          </button>
        )}
        <button className={styles.sequelLink} onClick={() => setSequelTo(story.id)}>
          <BookPlus size={12} aria-hidden />
          Write a sequel
        </button>
        {pendingDeleteId === story.id ? (
          <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
            <button className={styles.deleteConfirmYes} onClick={(e) => doDelete(story, e)}>
              Delete
            </button>
            <button
              className={styles.deleteConfirmNo}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteId(null);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => confirmDelete(story, e)}
            disabled={deletingId === story.id}
            className={styles.deleteBtn}
            aria-label={`Delete ${story.title}`}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.greeting}>
              {user?.display_name ? `Good to see you, ${user.display_name.split(" ")[0]}` : "Your stories"}
            </h1>
            <p className={styles.subtitle}>
              {stories.length === 0
                ? "No stories yet"
                : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`}
              {seriesList.length > 0 && `, ${seriesList.length} series`}
            </p>
          </div>
          <div className={styles.headActions}>
            {stories.length > 0 && (
              <div className={styles.layoutToggle} role="group" aria-label="Show stories as">
                <button
                  type="button"
                  aria-pressed={layout === "cards"}
                  onClick={() => setLayout("cards")}
                  title="Show stories as cards"
                >
                  <LayoutGrid size={14} aria-hidden />
                  Cards
                </button>
                <button
                  type="button"
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                  title="Show stories as a list"
                >
                  <List size={14} aria-hidden />
                  List
                </button>
              </div>
            )}
            <button onClick={() => setImporting(true)} className={styles.importBtn}>
              <FileInput size={14} />
              Import
            </button>
            <button onClick={() => setNewSeries(true)} className={styles.importBtn}>
              <BookCopy size={14} />
              New series
            </button>
            <button onClick={() => setCreating(true)} className={styles.createBtn}>
              <Plus size={15} />
              New story
            </button>
          </div>
        </div>

        {stories.length === 0 && seriesList.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyBody}>
              <p className={styles.emptyHeadline}>A thinking space for writers.</p>
              <p className={styles.emptySubhead}>
                LoreStudio helps you plan, organize, and understand your story: characters, structure, plot,
                and the ideas connecting them. You do the writing; LoreStudio keeps the threads straight.
              </p>
              <ul className={styles.emptyFeatures} aria-label="Key features">
                <li>Build a lorebook of characters, settings, and relationships</li>
                <li>Map plot threads, arcs, and structure across any narrative form</li>
                <li>Interview characters and analyze story health with AI assistance</li>
              </ul>
              <div className={styles.emptyCtas}>
                <button onClick={() => setCreating(true)} className={styles.emptyBtn}>
                  <Plus size={14} />
                  Start a new story
                </button>
                <button onClick={() => setNewSeries(true)} className={styles.emptyImportBtn}>
                  <BookCopy size={14} />
                  Plan a series
                </button>
                <button onClick={() => setImporting(true)} className={styles.emptyImportBtn}>
                  <FileInput size={14} />
                  Import existing work
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.segments}>
            {segments.map((seg) =>
              seg.type === "stories" ? (
                <div key={`stories-${seg.stories[0].id}`}>{renderStories(seg.stories)}</div>
              ) : (
                <SeriesGroup
                  key={seg.series.id}
                  series={seg.series}
                  onNewBook={() =>
                    seg.books.length
                      ? setSequelTo(seg.books[seg.books.length - 1].id)
                      : navigate(seriesPath(seg.series.id, "plan"))
                  }
                >
                  {seg.books.length > 0 &&
                    renderStories(
                      seg.books,
                      (story) => seg.series.books.find((b) => b.story_id === story.id)?.position,
                      true,
                    )}
                </SeriesGroup>
              ),
            )}
          </div>
        )}
      </main>

      {(creating || sequelTo) && (
        <CreateStoryDialog
          sequelTo={sequelTo ?? undefined}
          onClose={() => {
            setCreating(false);
            setSequelTo(null);
          }}
        />
      )}
      {importing && <ImportWizard onClose={() => setImporting(false)} />}
      {newSeries && <NewSeriesDialog onClose={() => setNewSeries(false)} />}
    </div>
  );
}

/** "3,529 of 17,500 words" with a bar, or just the count when the story has no target. */
function StoryProgressLine({ progress }: { progress?: StoryProgress }) {
  if (!progress || progress.word_count === 0) return null;
  const words = progress.word_count.toLocaleString();
  return (
    <div className={styles.progress}>
      {progress.target_words ? (
        <>
          <div className={styles.progressTrack} aria-hidden>
            <span style={{ width: `${Math.min(100, progress.pct ?? 0)}%` }} />
          </div>
          <span>
            {words} of {progress.target_words.toLocaleString()} words
          </span>
        </>
      ) : (
        <span>{words} words</span>
      )}
    </div>
  );
}
