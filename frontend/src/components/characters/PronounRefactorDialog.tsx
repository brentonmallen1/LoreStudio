import { useState, useEffect } from "react";
import { Wand2, CheckSquare, Square, Loader } from "lucide-react";
import { api } from "../../api/client";
import type { Character, PronounRewriteProposal } from "../../types";
import { Modal } from "../common";
import styles from "./PronounRefactorDialog.module.css";

interface Props {
  characterId: string;
  oldPronouns: string;
  newPronouns: string;
  saved: Character;
  onDone: (saved: Character) => void;
  onSkip: () => void;
}

export default function PronounRefactorDialog({
  characterId,
  oldPronouns,
  newPronouns,
  saved,
  onDone,
  onSkip,
}: Props) {
  const [proposals, setProposals] = useState<PronounRewriteProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.previewPronounRefactor(characterId, newPronouns)
      .then((data) => {
        setProposals(data.proposals);
        setSelected(new Set(data.proposals.map((p) => p.id)));
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [characterId, newPronouns]);

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

  // Group proposals by scene for display
  const byScene = proposals.reduce<Record<string, { title: string; items: PronounRewriteProposal[] }>>(
    (acc, p) => {
      if (!acc[p.node_id]) acc[p.node_id] = { title: p.node_title, items: [] };
      acc[p.node_id].items.push(p);
      return acc;
    },
    {}
  );

  async function handleApply() {
    const rewrites = proposals
      .filter((p) => selected.has(p.id))
      .map((p) => ({ node_id: p.node_id, original: p.original, rewritten: p.rewritten }));

    setApplying(true);
    try {
      const result = await api.applyPronounRefactor(characterId, newPronouns, rewrites);
      onDone(result);
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = proposals.filter((p) => selected.has(p.id)).length;

  const footer = (
    <>
      <button className={styles.skipBtn} onClick={onSkip} disabled={applying || loading}>
        Skip
      </button>
      {!loading && proposals.length > 0 && (
        <button
          className={styles.applyBtn}
          onClick={handleApply}
          disabled={applying || selectedCount === 0}
        >
          {applying ? "Applying…" : `Apply ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
        </button>
      )}
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onSkip}
      title={`Update pronouns: ${oldPronouns || "—"} → ${newPronouns}`}
      icon={<Wand2 size={15} />}
      size="md"
      footer={footer}
    >
      <div className={styles.body}>
        {loading && (
          <div className={styles.loading}>
            <Loader size={16} className={styles.spin} />
            Analyzing scenes for gendered language…
          </div>
        )}

        {!loading && proposals.length === 0 && (
          <div className={styles.empty}>
            <p>No gendered language found for <strong>{saved.name}</strong> in your scenes.</p>
            <p className={styles.emptyHint}>Pronouns updated. No prose changes needed.</p>
          </div>
        )}

        {!loading && proposals.length > 0 && (
          <>
            <p className={styles.intro}>
              Found <strong>{proposals.length}</strong> passage{proposals.length !== 1 ? "s" : ""} to update.
              Review and select which to apply.
            </p>

            <div className={styles.toolbar}>
              <button className={styles.selectAllBtn} onClick={toggleAll}>
                {selected.size === proposals.length ? <CheckSquare size={13} /> : <Square size={13} />}
                {selected.size === proposals.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className={styles.list}>
              {Object.entries(byScene).map(([nodeId, { title, items }]) => (
                <div key={nodeId} className={styles.sceneGroup}>
                  <div className={styles.sceneTitle}>{title}</div>
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className={`${styles.card} ${selected.has(p.id) ? styles.cardSelected : ""}`}
                    >
                      <button
                        className={styles.checkbox}
                        onClick={() => toggleOne(p.id)}
                        aria-label={selected.has(p.id) ? "Deselect" : "Select"}
                      >
                        {selected.has(p.id) ? <CheckSquare size={13} /> : <Square size={13} />}
                      </button>
                      <div className={styles.cardContent}>
                        <div className={styles.original}>{p.original}</div>
                        <div className={styles.arrow}>↓</div>
                        <div className={styles.rewritten}>{p.rewritten}</div>
                        {p.explanation && (
                          <div className={styles.explanation}>{p.explanation}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
