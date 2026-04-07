import { useState, useEffect } from "react";
import { X, Tag, User, AlertCircle, CheckSquare, Square } from "lucide-react";
import { api } from "../../api/client";
import type { ProposedDialogueTag, StructureNode } from "../../types";
import styles from "./AutoTagDialoguePanel.module.css";

interface Props {
  sceneId: string;
  onClose: () => void;
  onApplied: (updatedNode: StructureNode) => void;
}

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <span className={styles.confidence} title={`Confidence: ${Math.round(value * 100)}%`}>
      {[1, 2, 3].map(i => (
        <span key={i} className={`${styles.dot} ${i <= level ? styles.dotFilled : ""}`} />
      ))}
    </span>
  );
}

export default function AutoTagDialoguePanel({ sceneId, onClose, onApplied }: Props) {
  const [proposals, setProposals] = useState<ProposedDialogueTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editedSpeakers, setEditedSpeakers] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    api.suggestDialogueTags(sceneId)
      .then((data) => {
        setProposals(data);
        // Pre-select proposals that have an inferred speaker
        const preSelected = new Set(data.filter(p => p.inferred_speaker).map(p => p.id));
        setSelected(preSelected);
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [sceneId]);

  function toggleAll() {
    if (selected.size === proposals.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(proposals.map(p => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    const tags = proposals
      .filter(p => selected.has(p.id))
      .map(p => ({
        quote_content: p.quote_content,
        speaker_name: editedSpeakers[p.id] ?? p.inferred_speaker ?? "",
      }))
      .filter(t => t.speaker_name.trim());

    if (!tags.length) return;

    setApplying(true);
    try {
      const updated = await api.applyDialogueTags(sceneId, tags);
      onApplied(updated);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  const applicableCount = proposals.filter(
    p => selected.has(p.id) && (editedSpeakers[p.id] ?? p.inferred_speaker ?? "").trim()
  ).length;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Tag size={15} />
            <span className={styles.title}>Auto-Tag Dialogue</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {loading && (
            <div className={styles.empty}>Analyzing scene…</div>
          )}

          {!loading && proposals.length === 0 && (
            <div className={styles.empty}>
              <Tag size={22} className={styles.emptyIcon} />
              <p>No untagged quotes found.</p>
              <p className={styles.emptyHint}>All dialogue already has explicit attribution, or no standalone quotes were detected.</p>
            </div>
          )}

          {!loading && proposals.length > 0 && (
            <>
              <div className={styles.toolbar}>
                <button className={styles.selectAllBtn} onClick={toggleAll}>
                  {selected.size === proposals.length ? <CheckSquare size={13} /> : <Square size={13} />}
                  {selected.size === proposals.length ? "Deselect all" : "Select all"}
                </button>
                <span className={styles.count}>{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</span>
              </div>

              <div className={styles.list}>
                {proposals.map(p => {
                  const isSelected = selected.has(p.id);
                  const speakerVal = editedSpeakers[p.id] ?? p.inferred_speaker ?? "";
                  return (
                    <div
                      key={p.id}
                      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                    >
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

                      {p.source_excerpt && (
                        <p className={styles.excerpt}>{p.source_excerpt}</p>
                      )}

                      <div className={styles.cardBottom}>
                        <User size={12} className={styles.speakerIcon} />
                        <input
                          className={styles.speakerInput}
                          value={speakerVal}
                          onChange={e => setEditedSpeakers(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Speaker name…"
                        />
                        {p.inferred_speaker && (
                          <ConfidenceDots value={p.confidence} />
                        )}
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
              disabled={applying || applicableCount === 0}
            >
              {applying ? "Applying…" : `Apply ${applicableCount > 0 ? `(${applicableCount})` : ""}`}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
