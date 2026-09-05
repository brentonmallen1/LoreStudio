import { useState, useEffect, useRef } from "react";
import { X, Tag, User, AlertCircle, CheckSquare, Square, BrainCircuit, Loader } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { ProposedDialogueTag, StructureNode } from "../../types";
import styles from "./AutoTagDialoguePanel.module.css";

interface Props {
  sceneId: string;
  storyId?: string;
  characterNames?: string[];
  onClose: () => void;
  onApplied: (updatedNode: StructureNode) => void;
}

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <span className={styles.confidence} title={`Confidence: ${Math.round(value * 100)}%`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`${styles.dot} ${i <= level ? styles.dotFilled : ""}`} />
      ))}
    </span>
  );
}

interface SpeakerInputProps {
  value: string;
  characterNames: string[];
  storyId?: string;
  onChange: (val: string) => void;
  onNewCharacter?: (name: string) => void;
}

function SpeakerInput({ value, characterNames, storyId, onChange, onNewCharacter }: SpeakerInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // When empty show all; when typing filter by prefix; exclude exact match
  const filtered = value.trim()
    ? characterNames.filter(
        (n) => n.toLowerCase().startsWith(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase(),
      )
    : characterNames;

  // Show "Create new" option when the typed name doesn't exactly match any character
  const showCreate =
    storyId && value.trim() && !characterNames.some((n) => n.toLowerCase() === value.trim().toLowerCase());

  const showDropdown = open && (filtered.length > 0 || !!showCreate);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className={styles.speakerCombobox}>
      <input
        className={styles.speakerInput}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Speaker name…"
      />
      {showDropdown && (
        <div className={styles.speakerDropdown}>
          {filtered.map((name) => (
            <button
              key={name}
              className={styles.speakerDropdownItem}
              onPointerDown={(e) => {
                e.preventDefault();
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
          {showCreate && (
            <button
              className={`${styles.speakerDropdownItem} ${styles.speakerDropdownCreate}`}
              onPointerDown={(e) => {
                e.preventDefault();
                const name = value.trim();
                onChange(name);
                setOpen(false);
                onNewCharacter?.(name);
              }}
            >
              + Create "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AutoTagDialoguePanel({
  sceneId,
  storyId,
  characterNames = [],
  onClose,
  onApplied,
}: Props) {
  const { characters, setCharacters } = useStoryStore();
  const [proposals, setProposals] = useState<ProposedDialogueTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [aiRefining, setAiRefining] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editedSpeakers, setEditedSpeakers] = useState<Record<string, string>>({});
  // Tracks names of newly created characters (for the current session)
  const [localCharacterNames, setLocalCharacterNames] = useState<string[]>(characterNames);

  // Sync when characterNames prop changes
  useEffect(() => {
    setLocalCharacterNames(characterNames);
  }, [characterNames]);

  useEffect(() => {
    setLoading(true);
    api
      .suggestDialogueTags(sceneId)
      .then((data) => {
        setProposals(data);
        // Pre-select proposals that have an inferred speaker
        const preSelected = new Set(data.filter((p) => p.inferred_speaker).map((p) => p.id));
        setSelected(preSelected);
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [sceneId]);

  function toggleAll() {
    if (selected.size === proposals.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(proposals.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleNewCharacter(name: string) {
    if (!storyId || !name.trim()) return;
    try {
      const newChar = await api.createCharacter(storyId, { name: name.trim() });
      // Add to local list for immediate autocomplete use
      setLocalCharacterNames((prev) => [...prev, newChar.name]);
      // Update the global store so @mentions and the editor know about it
      setCharacters([...characters, newChar]);
    } catch {
      /* silently skip if creation fails */
    }
  }

  async function handleAiRefine() {
    setAiRefining(true);
    try {
      const aiProposals = await api.aiSuggestDialogueSpeakers(sceneId);
      setProposals(aiProposals);
      const preSelected = new Set(aiProposals.filter((p) => p.inferred_speaker).map((p) => p.id));
      setSelected(preSelected);
      setEditedSpeakers({});
    } catch {
      // ignore
    } finally {
      setAiRefining(false);
    }
  }

  async function handleApply() {
    const tags = proposals
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        quote_content: p.quote_content,
        speaker_name: editedSpeakers[p.id] ?? p.inferred_speaker ?? "",
      }))
      .filter((t) => t.speaker_name.trim());

    if (!tags.length) return;

    setApplying(true);
    try {
      const updated = await api.applyDialogueTags(sceneId, tags);
      onApplied(updated);
      // Rescan so the panel shows remaining untagged dialogue
      const fresh = await api.suggestDialogueTags(sceneId);
      setProposals(fresh);
      setSelected(new Set(fresh.filter((p) => p.inferred_speaker).map((p) => p.id)));
      setEditedSpeakers({});
      if (fresh.length === 0) onClose();
    } finally {
      setApplying(false);
    }
  }

  const applicableCount = proposals.filter(
    (p) => selected.has(p.id) && (editedSpeakers[p.id] ?? p.inferred_speaker ?? "").trim(),
  ).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tag size={15} />
            <span className={styles.title}>Tag Suggestions</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.empty}>Analyzing scene…</div>}

          {!loading && proposals.length === 0 && (
            <div className={styles.empty}>
              <Tag size={22} className={styles.emptyIcon} />
              <p>No untagged quotes found.</p>
              <p className={styles.emptyHint}>
                All dialogue already has explicit attribution, or no standalone quotes were detected.
              </p>
            </div>
          )}

          {!loading && proposals.length > 0 && (
            <>
              <div className={styles.toolbar}>
                <button className={styles.selectAllBtn} onClick={toggleAll}>
                  {selected.size === proposals.length ? <CheckSquare size={13} /> : <Square size={13} />}
                  {selected.size === proposals.length ? "Deselect all" : "Select all"}
                </button>
                <button
                  className={styles.aiRefineBtn}
                  onClick={handleAiRefine}
                  disabled={aiRefining || applying}
                  title="Use AI to re-analyze speakers for this scene"
                >
                  {aiRefining ? <Loader size={11} className={styles.spinner} /> : <BrainCircuit size={11} />}
                  {aiRefining ? "Refining…" : "AI Refine"}
                </button>
                <span className={styles.count}>
                  {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className={styles.list}>
                {proposals.map((p) => {
                  const isSelected = selected.has(p.id);
                  const speakerVal = editedSpeakers[p.id] ?? p.inferred_speaker ?? "";
                  return (
                    <div key={p.id} className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}>
                      <div className={styles.cardTop}>
                        <button
                          className={styles.checkbox}
                          onClick={() => toggleOne(p.id)}
                          aria-label={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <blockquote className={styles.quote}>"{p.quote_content}"</blockquote>
                      </div>

                      {p.source_excerpt && <p className={styles.excerpt}>{p.source_excerpt}</p>}

                      <div className={styles.cardBottom}>
                        <User size={12} className={styles.speakerIcon} />
                        <SpeakerInput
                          value={speakerVal}
                          characterNames={localCharacterNames}
                          storyId={storyId}
                          onChange={(val) => setEditedSpeakers((prev) => ({ ...prev, [p.id]: val }))}
                          onNewCharacter={handleNewCharacter}
                        />
                        {p.inferred_speaker && <ConfidenceDots value={p.confidence} />}
                        {!p.inferred_speaker && (
                          <span className={styles.unknownBadge}>
                            <AlertCircle size={11} /> No speaker found
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!loading && proposals.length > 0 && (
          <div className={styles.footer}>
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={applying || aiRefining || applicableCount === 0}
            >
              {applying ? "Applying…" : `Apply ${applicableCount > 0 ? `(${applicableCount})` : ""}`}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
