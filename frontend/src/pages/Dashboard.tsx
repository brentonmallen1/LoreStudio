import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, FileInput, Trash2, ArrowRight, BookPlus } from "lucide-react";
import { api } from "../api/client";
import { progressApi, type StoryProgress } from "../api/progress";
import { seriesApi, type SeriesSummary } from "../api/series";
import { dashboardSegments } from "../lib/series/dashboard";
import { bookLabel } from "../stores/seriesStore";
import { useAuthStore } from "../stores/authStore";
import { useStoryStore } from "../stores/storyStore";
import { formatRelative } from "../lib/utils";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import SeriesGroup from "../components/series/SeriesGroup";
import ImportWizard from "../components/import/ImportWizard";
import type { Story } from "../types";
import styles from "./Dashboard.module.css";

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
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Words, progress toward the target and the scene to continue in, per story.
  const [progress, setProgress] = useState<Record<string, StoryProgress>>({});

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

  async function doDelete(story: Story, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDeleteId(null);
    setDeletingId(story.id);
    await api.deleteStory(story.id);
    removeStory(story.id);
    setDeletingId(null);
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
            <button onClick={() => setImporting(true)} className={styles.importBtn}>
              <FileInput size={14} />
              Import
            </button>
            <button onClick={() => setCreating(true)} className={styles.createBtn}>
              <Plus size={15} />
              New story
            </button>
          </div>
        </div>

        {stories.length === 0 ? (
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
                <div key={`stories-${seg.stories[0].id}`} className={styles.grid}>
                  {seg.stories.map((story) => renderCard(story))}
                </div>
              ) : (
                <SeriesGroup
                  key={seg.series.id}
                  series={seg.series}
                  onNewBook={() => setSequelTo(seg.books[seg.books.length - 1]?.id ?? null)}
                >
                  <div className={`${styles.grid} ${styles.seriesGrid}`}>
                    {seg.books.map((story) =>
                      renderCard(story, seg.series.books.find((b) => b.story_id === story.id)?.position),
                    )}
                  </div>
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
