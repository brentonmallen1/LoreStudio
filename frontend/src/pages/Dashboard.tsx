import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, Settings, LogOut, Clock } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import { formatRelative } from "../lib/utils";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import type { Story } from "../types";
import styles from "./Dashboard.module.css";

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const { stories, setStories, removeStory } = useStoryStore();
  const { setCommandPaletteOpen } = useUIStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.listStories().then(setStories).catch(console.error);
  }, [setStories]);

  async function handleDelete(story: Story, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return;
    setDeletingId(story.id);
    await api.deleteStory(story.id);
    removeStory(story.id);
    setDeletingId(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>LoreStudio</span>
        <div className={styles.topbarActions}>
          <button onClick={() => setCommandPaletteOpen(true)} className={styles.searchHint}>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button onClick={() => navigate("/settings")} className={styles.iconBtn} title="Settings">
            <Settings size={16} />
          </button>
          <button onClick={logout} className={styles.iconBtn} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

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
          <button onClick={() => setCreating(true)} className={styles.createBtn}>
            <Plus size={15} />
            New Story
          </button>
        </div>

        {stories.length === 0 ? (
          <div className={styles.empty}>
            <BookOpen size={40} className={styles.emptyIcon} />
            <p className={styles.emptyText}>Begin your first story</p>
            <button onClick={() => setCreating(true)} className={styles.emptyBtn}>
              Create a story
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {stories.map((story) => (
              <div
                key={story.id}
                onClick={() => navigate(`/stories/${story.id}`)}
                className={styles.storyCard}
              >
                <h3 className={styles.storyTitle}>{story.title}</h3>
                {story.description && (
                  <p className={styles.storyDesc}>{story.description}</p>
                )}
                <div className={styles.storymeta}>
                  <Clock size={11} />
                  {formatRelative(story.updated_at)}
                </div>
                <button
                  onClick={(e) => handleDelete(story, e)}
                  disabled={deletingId === story.id}
                  className={styles.deleteBtn}
                  title="Delete story"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {creating && <CreateStoryDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
