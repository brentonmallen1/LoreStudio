import { useState, useEffect } from "react";
import { X, Compass, CheckSquare, Square, Loader2, BookOpen, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./ExtractOutlinePanel.module.css";
import { useAIAvailable } from "../../lib/mode";

interface ExtractedItem {
  text: string;
  beat_type: "plot" | "character" | "theme" | "setting";
  suggested_scene_title: string;
  confidence: number;
  reasoning: string;
}

interface Props {
  storyId: string;
  onClose: () => void;
  onCreated: (outlineId: string) => void;
}

const BEAT_TYPE_COLORS: Record<string, string> = {
  plot: "var(--color-accent)",
  character: "var(--color-ai)",
  theme: "var(--segment-chapter, #7c6fae)",
  setting: "var(--color-nlp)",
};

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.9 ? 3 : value >= 0.7 ? 2 : 1;
  return (
    <span className={styles.confidence} title={`Confidence: ${Math.round(value * 100)}%`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`${styles.dot} ${i <= level ? styles.dotFilled : ""}`} />
      ))}
    </span>
  );
}

export default function ExtractOutlinePanel({ storyId, onClose, onCreated }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [suggestedName, setSuggestedName] = useState("Extracted Outline");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .extractOutlineFromProse(storyId)
      .then((result: StructuredResult) => {
        if (!result.success || !result.data) {
          setError(result.raw_text ?? "Extraction failed: no structured output returned.");
          return;
        }
        const data = result.data as { items: ExtractedItem[]; suggested_name: string };
        setItems(data.items ?? []);
        setSuggestedName(data.suggested_name ?? "Extracted Outline");
        setSelected(new Set((data.items ?? []).map((_, i) => i)));
      })
      .catch((e: Error) => setError(e.message ?? "Extraction failed."))
      .finally(() => setLoading(false));
  }, [storyId]);

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  }

  function toggleOne(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function getText(idx: number) {
    return editedTexts[idx] ?? items[idx]?.text ?? "";
  }

  function handleTextChange(idx: number, value: string) {
    setEditedTexts((prev) => ({ ...prev, [idx]: value }));
  }

  async function handleCreate() {
    const selectedItems = Array.from(selected)
      .sort((a, b) => a - b)
      .map((idx) => ({ text: getText(idx), beat_type: items[idx].beat_type }));

    if (!selectedItems.length) return;
    setCreating(true);
    try {
      const outline = await api.createOutline(storyId, suggestedName);
      for (let i = 0; i < selectedItems.length; i++) {
        await api.createOutlineItem(outline.id, {
          text: selectedItems[i].text,
          beat_type: selectedItems[i].beat_type,
          position: i,
        });
      }
      onCreated(outline.id);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  if (!aiAvailable) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Compass size={14} className={styles.headerIcon} />
            <span className={styles.title}>Extract Outline from Prose</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {loading && (
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spinner} />
              <span>Analyzing manuscript…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorState}>
              <AlertTriangle size={20} className={styles.errorIcon} />
              <p className={styles.errorTitle}>Extraction failed</p>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className={styles.empty}>
              <BookOpen size={28} className={styles.emptyIcon} />
              <p>No beats extracted</p>
              <p className={styles.emptyHint}>Write some scenes first, then try again.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className={styles.subheader}>
                <div className={styles.nameRow}>
                  <span className={styles.nameLabel}>Outline name</span>
                  <input
                    className={styles.nameInput}
                    value={suggestedName}
                    onChange={(e) => setSuggestedName(e.target.value)}
                  />
                </div>
                <div className={styles.toolbar}>
                  <button className={styles.selectAllBtn} onClick={toggleAll}>
                    {selected.size === items.length ? <CheckSquare size={13} /> : <Square size={13} />}
                    {selected.size === items.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className={styles.count}>
                    {items.length} beat{items.length !== 1 ? "s" : ""} found
                  </span>
                </div>
              </div>

              <div className={styles.list}>
                {items.map((item, idx) => {
                  const isSelected = selected.has(idx);
                  const typeColor = BEAT_TYPE_COLORS[item.beat_type] ?? "var(--color-text-muted)";
                  return (
                    <div
                      key={idx}
                      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                      style={{ "--beat-color": typeColor } as React.CSSProperties}
                    >
                      <div className={styles.cardTop}>
                        <button
                          className={styles.checkbox}
                          onClick={() => toggleOne(idx)}
                          aria-label={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <div className={styles.cardBody}>
                          <div className={styles.cardMeta}>
                            <span className={styles.beatType} style={{ color: typeColor }}>
                              {item.beat_type}
                            </span>
                            {item.suggested_scene_title && (
                              <span className={styles.sceneRef}>{item.suggested_scene_title}</span>
                            )}
                            <ConfidenceDots value={item.confidence} />
                          </div>
                          <textarea
                            className={styles.textEdit}
                            value={getText(idx)}
                            onChange={(e) => handleTextChange(idx, e.target.value)}
                            rows={2}
                          />
                          {item.reasoning && <p className={styles.reasoning}>{item.reasoning}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!loading && !error && items.length > 0 && (
          <div className={styles.footer}>
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={creating || selected.size === 0}
            >
              {creating ? (
                <>
                  <Loader2 size={13} className={styles.spinnerSm} /> Creating…
                </>
              ) : (
                `Create Outline (${selected.size})`
              )}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {!loading && (error || items.length === 0) && (
          <div className={styles.footer}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
