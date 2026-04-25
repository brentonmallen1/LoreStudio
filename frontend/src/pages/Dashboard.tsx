import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, FileInput, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useStoryStore } from "../stores/storyStore";
import { formatRelative } from "../lib/utils";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import ImportWizard from "../components/import/ImportWizard";
import type { Story } from "../types";
import styles from "./Dashboard.module.css";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { stories, setStories, removeStory } = useStoryStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if the store is empty — avoids refetch on every navigation back to dashboard
    if (stories.length === 0) {
      api.listStories().then(setStories).catch(console.error);
    }
  }, []);

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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.greeting}>
              {user?.display_name ? `Good to see you, ${user.display_name.split(" ")[0]}` : "Your Stories"}
            </h1>
            <p className={styles.subtitle}>
              {stories.length === 0 ? "No stories yet" : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`}
            </p>
          </div>
          <div className={styles.headActions}>
            <button onClick={() => setImporting(true)} className={styles.importBtn}>
              <FileInput size={14} />
              Import
            </button>
            <button onClick={() => setCreating(true)} className={styles.createBtn}>
              <Plus size={15} />
              New Story
            </button>
          </div>
        </div>

        {stories.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyBody}>
              <p className={styles.emptyHeadline}>A thinking space for writers.</p>
              <p className={styles.emptySubhead}>
                LoreStudio helps you plan, organize, and understand your story — characters, structure, plot, and the ideas connecting them. You do the writing; LoreStudio keeps the threads straight.
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
          <div className={styles.grid}>
            {stories.map((story) => (
              <div key={story.id} className={styles.storyCardWrap}>
                <button
                  onClick={() => navigate(`/stories/${story.id}`)}
                  className={styles.storyCard}
                  aria-label={`Open ${story.title}`}
                >
                  <h3 className={styles.storyTitle}>{story.title}</h3>
                  {story.description && (
                    <p className={styles.storyDesc}>{story.description}</p>
                  )}
                  <div className={styles.storymeta}>
                    <Clock size={11} />
                    {formatRelative(story.updated_at)}
                  </div>
                </button>
                {pendingDeleteId === story.id ? (
                  <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.deleteConfirmYes} onClick={(e) => doDelete(story, e)}>Delete</button>
                    <button className={styles.deleteConfirmNo} onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}>Cancel</button>
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
            ))}
          </div>
        )}
      </main>

      {creating && <CreateStoryDialog onClose={() => setCreating(false)} />}
      {importing && <ImportWizard onClose={() => setImporting(false)} />}
    </div>
  );
}
