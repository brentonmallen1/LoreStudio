import { useState, useEffect, useRef } from "react";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";
import { X, Orbit, CheckSquare, Square, Loader2, BookOpen, AlertTriangle } from "lucide-react";
import { trayApi } from "../../api/tray";
import type { StructuredResult } from "../../types";
import styles from "./FillTrayPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

interface ExtractedItem {
  text: string;
  suggested_scene_title: string;
  confidence: number;
  reasoning: string;
}

interface Props {
  storyId: string;
  onClose: () => void;
  /** The picks, as ideas for the tray (one change). */
  onKeep: (items: { text: string; notes?: string }[]) => Promise<void>;
}

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

/**
 * Studio's Fill the tray from my prose (doc 29 D3): the key moments of the written scenes,
 * offered as ideas for the Outline's Not placed yet tray. The answer is kept on the story
 * (A7): opening the panel again shows what it found, through a restart; it reads the prose
 * again only on Ask again, or the first time, when nothing is kept. Nothing goes in the tray
 * until the writer picks it.
 */
export default function FillTrayPanel({ storyId, onClose, onKeep }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const kept = useKeptAnswer({ storyId, type: "story", id: storyId }, "extract-outline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerAt = kept.answer?.updated_at ?? "";
  const data = kept.answer?.data as { items?: ExtractedItem[] } | undefined;
  const items = data?.items ?? [];
  // The author's edits and picks belong to one answer: asking again starts them over.
  const [edits, setEdits] = useState<{ at: string; texts: Record<number, string> }>({ at: "", texts: {} });
  const [picked, setPicked] = useState<{ at: string; set: Set<number> } | null>(null);
  const [creating, setCreating] = useState(false);
  const started = useRef(false);
  const editedTexts = edits.at === answerAt ? edits.texts : {};
  const selected = picked?.at === answerAt ? picked.set : new Set(items.map((_, i) => i));
  const setSelected = (next: Set<number>) => setPicked({ at: answerAt, set: next });

  async function extract() {
    setLoading(true);
    setError(null);
    try {
      const result: StructuredResult = await trayApi.fromProse(storyId);
      if (!result.success || !result.data) {
        setError(result.raw_text ?? "The Assistant's answer could not be read.");
        return;
      }
      await kept.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The prose could not be read.");
    } finally {
      setLoading(false);
    }
  }

  // Opening the panel asks only when nothing is kept yet.
  useEffect(() => {
    if (!kept.loaded || kept.answer || started.current) return;
    started.current = true;
    queueMicrotask(() => void extract());
  });

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  }

  function toggleOne(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  }

  function getText(idx: number) {
    return editedTexts[idx] ?? items[idx]?.text ?? "";
  }

  function handleTextChange(idx: number, value: string) {
    setEdits({ at: answerAt, texts: { ...editedTexts, [idx]: value } });
  }

  async function handleKeep() {
    const picks = Array.from(selected)
      .sort((a, b) => a - b)
      .map((idx) => {
        const scene = items[idx].suggested_scene_title;
        return { text: getText(idx).trim(), notes: scene ? `Read in “${scene}”` : "" };
      })
      .filter((p) => p.text);
    if (!picks.length) return;
    setCreating(true);
    try {
      await onKeep(picks);
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
            <Orbit size={14} className={styles.headerIcon} />
            <span className={styles.title}>Fill the tray from my prose</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {(loading || !kept.loaded) && (
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spinner} />
              <span>Reading your scenes…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorState}>
              <AlertTriangle size={20} className={styles.errorIcon} />
              <p className={styles.errorTitle}>Nothing came back</p>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {!loading && kept.loaded && !error && items.length === 0 && (
            <div className={styles.empty}>
              <BookOpen size={28} className={styles.emptyIcon} />
              <p>No moments found</p>
              <p className={styles.emptyHint}>Write some scenes first, then try again.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && kept.answer && (
            <>
              <KeptAnswerBar
                answer={kept.answer}
                heading="Moments from your prose"
                context={{ storyId }}
                onAskAgain={() => void extract()}
                asking={loading}
                onClear={() => void kept.clear()}
              />
              <div className={styles.subheader}>
                <p className={styles.intro}>
                  Pick the ones to keep. They go in the Outline's Not placed yet tray, to place where they
                  belong.
                </p>
                <div className={styles.toolbar}>
                  <button className={styles.selectAllBtn} onClick={toggleAll}>
                    {selected.size === items.length ? <CheckSquare size={13} /> : <Square size={13} />}
                    {selected.size === items.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className={styles.count}>
                    {items.length} moment{items.length !== 1 ? "s" : ""} found
                  </span>
                </div>
              </div>

              <div className={styles.list}>
                {items.map((item, idx) => {
                  const isSelected = selected.has(idx);
                  return (
                    <div key={idx} className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}>
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
              onClick={handleKeep}
              disabled={creating || selected.size === 0}
            >
              {creating ? (
                <>
                  <Loader2 size={13} className={styles.spinnerSm} /> Keeping…
                </>
              ) : (
                `Put ${selected.size} in the tray`
              )}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {!loading && kept.loaded && (error || items.length === 0) && (
          <div className={styles.footer}>
            <button className={styles.createBtn} onClick={() => void extract()}>
              <Orbit size={13} /> Ask again
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
