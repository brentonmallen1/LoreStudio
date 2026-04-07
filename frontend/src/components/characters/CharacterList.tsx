import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserCircle2, Trash2, Compass, List, Network } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import CharacterFormDialog from "./CharacterFormDialog";
import RelationshipSuggestionDialog from "./RelationshipSuggestionDialog";
import RelationshipGraph from "./RelationshipGraph";
import styles from "./CharacterList.module.css";

interface Props {
  storyId: string;
}

export default function CharacterList({ storyId }: Props) {
  const navigate = useNavigate();
  const { characters, removeCharacter } = useStoryStore();
  const [view, setView] = useState<"list" | "graph">("list");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showRelSuggestions, setShowRelSuggestions] = useState(false);

  async function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete character "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    await api.deleteCharacter(id);
    removeCharacter(id);
    setDeletingId(null);
  }

  function roleBadgeClass(role: string) {
    if (role === "protagonist") return `${styles.roleBadge} ${styles.protagonist}`;
    if (role === "antagonist") return `${styles.roleBadge} ${styles.antagonist}`;
    return styles.roleBadge;
  }

  const viewToggle = (
    <div className={styles.viewToggle}>
      <button
        className={`${styles.viewBtn} ${view === "list" ? styles.viewActive : ""}`}
        onClick={() => setView("list")}
        title="List view"
      >
        <List size={13} />
      </button>
      <button
        className={`${styles.viewBtn} ${view === "graph" ? styles.viewActive : ""}`}
        onClick={() => setView("graph")}
        title="Relationship graph"
        disabled={characters.length < 2}
      >
        <Network size={13} />
      </button>
    </div>
  );

  if (view === "graph") {
    return (
      <div className={styles.graphPage}>
        <div className={styles.graphHeader}>
          <h1 className={styles.title}>Characters</h1>
          <div className={styles.headerActions}>
            {viewToggle}
          </div>
        </div>
        <RelationshipGraph storyId={storyId} />
        {creating && <CharacterFormDialog storyId={storyId} onClose={() => setCreating(false)} />}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>Characters</h1>
          <div className={styles.headerActions}>
            {characters.length >= 2 && (
              <button onClick={() => setShowRelSuggestions(true)} className={styles.suggestBtn}>
                <Compass size={13} />
                Suggest relationships
              </button>
            )}
            {viewToggle}
            <button onClick={() => setCreating(true)} className={styles.addBtn}>
              <Plus size={14} />
              Add character
            </button>
          </div>
        </div>

        {characters.length === 0 ? (
          <div className={styles.empty}>
            <UserCircle2 size={40} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No characters yet</p>
            <button onClick={() => setCreating(true)} className={styles.emptyBtn}>
              Add your first character
            </button>
          </div>
        ) : (
          <div className={styles.list}>
            {characters.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/stories/${storyId}/characters/${c.id}`)}
                className={styles.card}
              >
                <div className={styles.avatar}>{c.name[0].toUpperCase()}</div>
                <div className={styles.cardBody}>
                  <div className={styles.nameRow}>
                    <span className={styles.characterName}>{c.name}</span>
                    <span className={roleBadgeClass(c.role)}>{c.role}</span>
                  </div>
                  {c.personality && (
                    <p className={styles.personality}>{c.personality}</p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(c.id, c.name, e)}
                  disabled={deletingId === c.id}
                  className={styles.deleteBtn}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <CharacterFormDialog storyId={storyId} onClose={() => setCreating(false)} />}
      {showRelSuggestions && (
        <RelationshipSuggestionDialog
          storyId={storyId}
          onClose={() => setShowRelSuggestions(false)}
        />
      )}
    </div>
  );
}
