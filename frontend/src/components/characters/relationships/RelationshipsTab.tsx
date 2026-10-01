import { useState, useEffect, useCallback } from "react";
import { Plus, LayoutGrid, Table2, Compass, Radar } from "lucide-react";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";
import type { CharacterRelationship, RelationshipSuggestion } from "../../../types";
import RelationshipCard from "./RelationshipCard";
import RelationshipEditor from "./RelationshipEditor";
import RelationshipMatrixView from "./RelationshipMatrixView";
import RelationshipRadarChart from "./RelationshipRadarChart";
import RelationshipSuggestionsModal from "./RelationshipSuggestionsModal";
import ValidationWarnings from "./ValidationWarnings";
import styles from "./RelationshipsTab.module.css";
import AIOnly from "../../ai/AIOnly";

type ViewMode = "focus" | "matrix" | "radar";

interface CreateTarget {
  fromId: string;
  toId: string;
}

interface Props {
  characterId: string;
  storyId: string;
}

export default function RelationshipsTab({ characterId, storyId }: Props) {
  const { characters } = useStoryStore();
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CharacterRelationship | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[] | null>(null);
  const [discoverError, setDiscoverError] = useState("");

  const load = useCallback(() => {
    api
      .listRelationships(characterId)
      .then(setRelationships)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [characterId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(fromId = characterId, toId = "") {
    setEditTarget(null);
    setCreateTarget({ fromId, toId });
    setEditorOpen(true);
  }

  function openEdit(rel: CharacterRelationship) {
    setEditTarget(rel);
    setCreateTarget(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditTarget(null);
    setCreateTarget(null);
  }

  function handleSaved(saved: CharacterRelationship) {
    setRelationships((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    closeEditor();
  }

  function handleDeleted(id: string) {
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAccept(rel: CharacterRelationship) {
    const updated = await api.acceptRelationshipSuggestion(rel.id);
    setRelationships((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleDiscoverProfile() {
    setDiscovering(true);
    setDiscoverError("");
    try {
      const result = await api.suggestRelationships(storyId, characterId);
      if (result.success && result.data?.suggestions?.length) {
        setSuggestions(result.data.suggestions);
      } else if (result.success && !result.data?.suggestions?.length) {
        setDiscoverError("AI returned no suggestions. Try again or add more character detail.");
      } else {
        setDiscoverError("Relationship discovery failed. Check that Ollama is running.");
      }
    } catch {
      setDiscoverError("Could not reach the AI service.");
    } finally {
      setDiscovering(false);
    }
  }

  const confirmed = relationships.filter((r) => !r.is_suggested);
  const suggested = relationships.filter((r) => r.is_suggested);
  const visible = confirmed.filter((r) => showHidden || r.visibility === "public");

  if (loading) return <div className={styles.loading}>Loading relationships…</div>;

  return (
    <div className={styles.root}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "focus" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("focus")}
            title="Focus view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "matrix" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("matrix")}
            title="Matrix view"
          >
            <Table2 size={14} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "radar" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("radar")}
            title="Radar chart"
          >
            <Radar size={14} />
          </button>
        </div>

        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden
        </label>

        <div className={styles.actions}>
          <AIOnly>
            <button
              className={styles.discoverBtn}
              onClick={handleDiscoverProfile}
              disabled={discovering}
              title="Use AI to suggest relationships based on character profiles"
            >
              <Compass size={13} />
              {discovering ? "Discovering…" : "Discover relationships"}
            </button>
          </AIOnly>
          {discoverError && <span className={styles.discoverError}>{discoverError}</span>}
          <button className={styles.addBtn} onClick={() => openCreate()}>
            <Plus size={14} />
            Add relationship
          </button>
        </div>
      </div>

      {/* ── Validation warnings ── */}
      <ValidationWarnings
        relationships={relationships}
        characters={characters}
        currentCharacterId={characterId}
      />

      {/* ── AI Suggestions banner ── */}
      {suggested.length > 0 && (
        <div className={styles.suggestionBanner}>
          <span className={styles.suggestionText}>
            {suggested.length} AI-suggested relationship{suggested.length > 1 ? "s" : ""} below. Review and
            accept or delete.
          </span>
        </div>
      )}

      {/* ── Content ── */}
      {viewMode === "focus" ? (
        <div className={styles.focusView}>
          {[...visible, ...suggested].length === 0 ? (
            <div className={styles.empty}>
              <p>No relationships yet.</p>
              <button className={styles.addBtn} onClick={() => openCreate()}>
                <Plus size={14} /> Add first relationship
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {visible.map((rel) => (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  targetCharacter={characters.find((c) => c.id === rel.related_character_id)}
                  onClick={() => openEdit(rel)}
                  onDelete={() => handleDeleted(rel.id)}
                />
              ))}
              {suggested.map((rel) => (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  targetCharacter={characters.find((c) => c.id === rel.related_character_id)}
                  onClick={() => openEdit(rel)}
                  onDelete={() => handleDeleted(rel.id)}
                  onAccept={() => handleAccept(rel)}
                />
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "matrix" ? (
        <div className={styles.matrixView}>
          <RelationshipMatrixView
            characters={characters}
            relationships={[...confirmed, ...(showHidden ? [] : [])]}
            onEditRelationship={openEdit}
            onCreateRelationship={(fromId, toId) => openCreate(fromId, toId)}
            showHidden={showHidden}
          />
        </div>
      ) : (
        <div className={styles.radarView}>
          <RelationshipRadarChart
            focusCharacterId={characterId}
            characters={characters}
            relationships={visible}
          />
        </div>
      )}

      {/* ── Side panel editor ── */}
      {editorOpen && (
        <RelationshipEditor
          characterId={createTarget?.fromId ?? characterId}
          characters={characters}
          relationship={editTarget}
          existingRelationships={confirmed}
          onClose={closeEditor}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── AI suggestions review modal ── */}
      {suggestions && (
        <RelationshipSuggestionsModal
          suggestions={suggestions}
          characterId={characterId}
          characters={characters}
          existingRelationships={relationships}
          onClose={() => setSuggestions(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
