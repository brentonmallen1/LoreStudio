import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Table2, Search, ChevronRight, Orbit, ExternalLink } from "lucide-react";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";
import RelationshipMatrixView from "./RelationshipMatrixView";
import RelationshipSuggestionDialog from "../RelationshipSuggestionDialog";
import type { CharacterRelationship, Character } from "../../../types";
import styles from "./GlobalRelationshipsView.module.css";
import AIOnly from "../../ai/AIOnly";
import { relationshipTypeColor as typeColor, tint } from "../../../lib/relationships/colors";

interface Props {
  storyId: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TypePill({ type }: { type: string }) {
  const c = typeColor(type);
  return (
    <span className={styles.typePill} style={{ borderColor: tint(c, 45), background: tint(c, 8) }}>
      {type}
    </span>
  );
}

function CharacterGroup({
  character,
  rels,
  charMap,
  onNavigate,
}: {
  character: Character;
  rels: CharacterRelationship[];
  charMap: Record<string, Character>;
  onNavigate: (charId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const distinctTypes = Array.from(new Set(rels.map((r) => r.relationship_type))).slice(0, 4);

  return (
    <div className={styles.group}>
      <div className={styles.groupHeader} onClick={() => setExpanded((v) => !v)}>
        <div className={styles.groupAvatar}>{initials(character.name)}</div>

        <div className={styles.groupInfo}>
          <span className={styles.groupName}>{character.name}</span>
          <span className={`${styles.groupRole} ${styles[`role_${character.role}`] ?? ""}`}>
            {character.role}
          </span>
        </div>

        <div className={styles.groupTypes}>
          {distinctTypes.map((t) => (
            <TypePill key={t} type={t} />
          ))}
          {rels.length > distinctTypes.length && <span className={styles.groupCount}>{rels.length}</span>}
        </div>

        <button
          className={styles.viewBtn}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(character.id);
          }}
          title={`View ${character.name}'s relationships`}
          aria-label={`View ${character.name}'s relationships`}
        >
          <ExternalLink size={12} />
        </button>

        <ChevronRight size={14} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} />
      </div>

      {expanded && (
        <div className={styles.groupBody}>
          {rels.map((rel) => {
            const other = charMap[rel.related_character_id];
            return (
              <div key={rel.id} className={styles.subRow}>
                <span className={styles.subAvatar}>{other ? initials(other.name) : "?"}</span>
                <span className={styles.subName}>{other?.name ?? "Unknown"}</span>
                <TypePill type={rel.relationship_type} />
                {rel.description && <span className={styles.subDesc}>{rel.description}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GlobalRelationshipsView({ storyId }: Props) {
  const navigate = useNavigate();
  const { characters } = useStoryStore();
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grouped" | "matrix">("grouped");
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listStoryRelationships(storyId)
      .then(setRelationships)
      .catch(() => setRelationships([]))
      .finally(() => setLoading(false));
  }, [storyId]);

  const charMap = useMemo(() => {
    const m: Record<string, Character> = {};
    characters.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [characters]);

  const filtered = useMemo(() => {
    return relationships.filter((r) => {
      if (!showHidden && r.visibility === "hidden") return false;
      if (search) {
        const q = search.toLowerCase();
        const fromName = charMap[r.character_id]?.name?.toLowerCase() ?? "";
        const toName = charMap[r.related_character_id]?.name?.toLowerCase() ?? "";
        if (!fromName.includes(q) && !toName.includes(q)) return false;
      }
      return true;
    });
  }, [relationships, showHidden, search, charMap]);

  // Group filtered relationships by their source character, preserving character order
  const groups = useMemo(() => {
    const byChar = new Map<string, CharacterRelationship[]>();
    filtered.forEach((r) => {
      const existing = byChar.get(r.character_id) ?? [];
      existing.push(r);
      byChar.set(r.character_id, existing);
    });
    // Sort groups by character order in the story
    return characters.filter((c) => byChar.has(c.id)).map((c) => ({ character: c, rels: byChar.get(c.id)! }));
  }, [filtered, characters]);

  function handleNavigate(characterId: string) {
    navigate(`/stories/${storyId}/lorebook/characters/${characterId}?tab=relationships`);
  }

  const totalCount = filtered.length;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === "grouped" ? styles.toggleActive : ""}`}
              onClick={() => setViewMode("grouped")}
              title="Grouped view"
            >
              By character
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === "matrix" ? styles.toggleActive : ""}`}
              onClick={() => setViewMode("matrix")}
              title="Matrix view"
            >
              <Table2 size={12} />
              Matrix
            </button>
          </div>

          <label className={styles.hiddenToggle}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden
          </label>

          <span className={styles.count}>
            {totalCount} relationship{totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.searchWrap}>
            <Search size={12} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Filter by character…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {characters.length >= 2 && (
            <AIOnly>
              <button className={styles.suggestBtn} onClick={() => setShowSuggestDialog(true)}>
                <Orbit size={13} />
                Suggest relationships
              </button>
            </AIOnly>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : viewMode === "matrix" ? (
        <div className={styles.matrixWrap}>
          <RelationshipMatrixView
            characters={characters}
            relationships={filtered}
            showHidden={showHidden}
            onEditRelationship={(rel) => handleNavigate(rel.character_id)}
            onCreateRelationship={(fromId) => handleNavigate(fromId)}
          />
        </div>
      ) : groups.length === 0 ? (
        <div className={styles.empty}>
          {relationships.length === 0
            ? "No relationships yet. Use Suggest relationships to get started."
            : "No characters match the search."}
        </div>
      ) : (
        <div className={styles.list}>
          {groups.map(({ character, rels }) => (
            <CharacterGroup
              key={character.id}
              character={character}
              rels={rels}
              charMap={charMap}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}

      {showSuggestDialog && (
        <RelationshipSuggestionDialog storyId={storyId} onClose={() => setShowSuggestDialog(false)} />
      )}
    </div>
  );
}
