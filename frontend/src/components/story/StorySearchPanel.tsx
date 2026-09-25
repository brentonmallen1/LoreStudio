import { announceScenesRewritten } from "../../lib/sceneEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  CaseSensitive,
  ChevronRight,
  Clapperboard,
  Layers,
  BookMarked,
  Flag,
  Zap,
} from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./StorySearchPanel.module.css";

interface Match {
  node_id: string;
  node_title: string;
  excerpt: string;
  match_count: number;
  level_type: string;
}

interface Props {
  storyId: string;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

const LEVEL_ICONS: Record<string, React.ElementType> = {
  act: Flag,
  chapter: BookMarked,
  scene: Clapperboard,
  beat: Zap,
};

function LevelIcon({ type }: { type: string }) {
  const Icon = LEVEL_ICONS[type?.toLowerCase()] ?? Layers;
  return <Icon size={13} />;
}

export default function StorySearchPanel({ storyId, onClose, onNavigateToNode }: Props) {
  const { activeStory } = useStoryStore();
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceResult, setReplaceResult] = useState<{
    replaced_count: number;
    scenes_affected: number;
  } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const runSearch = useCallback(
    async (q: string, cs: boolean) => {
      if (!q.trim()) {
        setMatches([]);
        return;
      }
      setSearching(true);
      setReplaceResult(null);
      try {
        const res = await api.storySearch(storyId, q, cs);
        setMatches(res.matches);
        setSelectedNodeIds(new Set(res.matches.map((m) => m.node_id)));
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    },
    [storyId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, caseSensitive), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, caseSensitive, runSearch]);

  async function handleReplace(nodeIds?: string[]) {
    if (!query.trim()) return;
    setReplacing(true);
    try {
      const res = await api.storyReplace(storyId, query, replacement, caseSensitive, nodeIds);
      setReplaceResult(res);
      announceScenesRewritten(res.node_ids ?? []);
      // Re-run search to update matches
      await runSearch(query, caseSensitive);
    } finally {
      setReplacing(false);
    }
  }

  function toggleNode(nodeId: string) {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  const storyTitle = activeStory?.title ?? "Story";

  return (
    <div className={styles.panel} role="dialog" aria-label="Find in story">
      <div className={styles.header}>
        <Search size={14} className={styles.headerIcon} />
        <span className={styles.headerTitle}>Find in {storyTitle}</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.inputRow}>
          <div className={styles.inputWrap}>
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Search…"
              aria-label="Search term"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            className={`${styles.iconBtn}${caseSensitive ? ` ${styles.iconBtnActive}` : ""}`}
            onClick={() => setCaseSensitive((c) => !c)}
            title="Case sensitive"
            aria-pressed={caseSensitive}
          >
            <CaseSensitive size={14} />
          </button>
        </div>

        <div className={styles.inputRow}>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Replace with…"
              aria-label="Replacement text"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => handleReplace([...selectedNodeIds])}
            disabled={replacing || selectedNodeIds.size === 0 || !query.trim()}
          >
            Replace in selected ({selectedNodeIds.size})
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => handleReplace()}
            disabled={replacing || matches.length === 0 || !query.trim()}
          >
            Replace all
          </button>
        </div>

        {replaceResult && (
          <p className={styles.replaceResult}>
            Replaced {replaceResult.replaced_count} occurrence{replaceResult.replaced_count !== 1 ? "s" : ""}{" "}
            across {replaceResult.scenes_affected} scene{replaceResult.scenes_affected !== 1 ? "s" : ""}.
          </p>
        )}
      </div>

      <div className={styles.results}>
        {searching && <p className={styles.status}>Searching…</p>}
        {!searching && query.trim() && matches.length === 0 && (
          <p className={styles.status}>No matches in {storyTitle}.</p>
        )}
        {!searching && !query.trim() && <p className={styles.status}>Type to search across all scenes.</p>}
        {matches.map((match) => (
          <div key={match.node_id} className={styles.matchItem}>
            <label className={styles.matchCheck}>
              <input
                type="checkbox"
                checked={selectedNodeIds.has(match.node_id)}
                onChange={() => toggleNode(match.node_id)}
                aria-label={`Include ${match.node_title} in replace`}
              />
            </label>
            <div className={styles.matchBody}>
              <button
                className={styles.matchTitle}
                onClick={() => {
                  onNavigateToNode(match.node_id);
                  onClose();
                }}
                title="Navigate to scene"
              >
                <LevelIcon type={match.level_type} />
                <span>{match.node_title}</span>
                <span className={styles.matchCount}>{match.match_count}×</span>
                <ChevronRight size={12} className={styles.matchArrow} />
              </button>
              {match.excerpt && <p className={styles.matchExcerpt}>{match.excerpt}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
