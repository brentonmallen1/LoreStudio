import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, List, Network, Users } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import CharacterFormDialog from "./CharacterFormDialog";
import RelationshipGraph from "./RelationshipGraph";
import GlobalRelationshipsView from "./relationships/GlobalRelationshipsView";
import styles from "./CharacterList.module.css";

interface Props {
  storyId: string;
}

export default function CharacterList({ storyId }: Props) {
  const navigate = useNavigate();
  const { characters, removeCharacter } = useStoryStore();
  const [view, setView] = useState<"list" | "relationships" | "graph">("list");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [portraitUrls, setPortraitUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!characters.length) return;
    Promise.all(
      characters.map((c) =>
        api.listAttachments("character", c.id)
          .then((atts) => {
            const portrait = atts.find((a) => a.role === "portrait");
            return { id: c.id, url: portrait ? api.assetFileUrl(portrait.asset_id) : null };
          })
          .catch(() => ({ id: c.id, url: null as string | null }))
      )
    ).then((results) => {
      setPortraitUrls((prev) => {
        const next = { ...prev };
        results.forEach(({ id, url }) => { if (url) next[id] = url; else delete next[id]; });
        return next;
      });
    });
  }, [characters.map((c) => c.id).join(",")]);

  async function doDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDeleteId(null);
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
        className={`${styles.viewBtn} ${view === "relationships" ? styles.viewActive : ""}`}
        onClick={() => setView("relationships")}
        title="All relationships"
        disabled={characters.length < 2}
      >
        <Users size={13} />
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

  return (
    <div className={styles.graphPage}>
      <div className={styles.graphHeader}>
        <h1 className={styles.title}>Characters</h1>
        <div className={styles.headerActions}>
          {view === "graph" && (
            <select
              className={styles.charJumpSelect}
              value=""
              onChange={(e) => {
                if (e.target.value) navigate(`/stories/${storyId}/characters/${e.target.value}?tab=relationships`);
              }}
            >
              <option value="">View character relationships…</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setCreating(true)} className={styles.addBtn}>
            <Plus size={14} />
            Add character
          </button>
          {viewToggle}
        </div>
      </div>

      {view === "graph" && (
        <RelationshipGraph
          storyId={storyId}
          onEditRelationship={(rel) => navigate(`/stories/${storyId}/characters/${rel.character_id}?tab=relationships`)}
        />
      )}

      {view === "relationships" && (
        <GlobalRelationshipsView storyId={storyId} />
      )}

      {view === "list" && (
        <div className={styles.listContent}>
          {characters.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No characters yet</p>
              <p className={styles.emptyDesc}>
                Each character gets a full profile, a role in the story, and their own interview
                space — so you can talk to them and understand them before you write them.
              </p>
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
                  {portraitUrls[c.id] ? (
                    <img src={portraitUrls[c.id]} alt={c.name} className={styles.avatarImg} loading="lazy" decoding="async" />
                  ) : (
                    <div className={styles.avatar}>{c.name[0].toUpperCase()}</div>
                  )}
                  <div className={styles.cardBody}>
                    <div className={styles.nameRow}>
                      <span className={styles.characterName}>{c.name}</span>
                      <span className={roleBadgeClass(c.role)}>{c.role}</span>
                    </div>
                    {c.personality && (
                      <p className={styles.personality}>{c.personality}</p>
                    )}
                  </div>
                  {pendingDeleteId === c.id ? (
                    <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.deleteConfirmYes} onClick={(e) => doDelete(c.id, e)}>Delete</button>
                      <button className={styles.deleteConfirmNo} onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDeleteId(c.id); }}
                      disabled={deletingId === c.id}
                      className={styles.deleteBtn}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && <CharacterFormDialog storyId={storyId} onClose={() => setCreating(false)} />}
    </div>
  );
}
