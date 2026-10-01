import { useState, useEffect } from "react";
import { X, Link, User, MapPin, CheckSquare, Square } from "lucide-react";
import { api } from "../../api/client";
import type { ProposedEntityLink, StructureNode } from "../../types";
import styles from "./AutoLinkEntitiesPanel.module.css";

interface Props {
  nodeId: string;
  onClose: () => void;
  onApplied: (updatedNode: StructureNode) => void;
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

const TYPE_ICON = {
  character: User,
  location: MapPin,
} as const;

const LINK_PREVIEW = {
  character: (name: string) => `@${name}`,
  location: (name: string) => `[[${name}]]`,
} as const;

export default function AutoLinkEntitiesPanel({ nodeId, onClose, onApplied }: Props) {
  const [proposals, setProposals] = useState<ProposedEntityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api
      .suggestEntityLinks(nodeId)
      .then((data) => {
        setProposals(data);
        setSelected(new Set(data.map((p) => p.id)));
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, [nodeId]);

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

  async function handleApply() {
    const links = proposals
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        matched_text: p.matched_text,
        entity_name: p.entity_name,
        entity_type: p.entity_type,
      }));

    if (!links.length) return;

    setApplying(true);
    try {
      const updated = await api.applyEntityLinks(nodeId, links);
      onApplied(updated);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  // Group proposals by entity type
  const characters = proposals.filter((p) => p.entity_type === "character");
  const locations = proposals.filter((p) => p.entity_type === "location");
  const selectedCount = selected.size;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Link size={15} />
            <span className={styles.title}>Link mentions</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.empty}>Scanning for entity mentions…</div>}

          {!loading && proposals.length === 0 && (
            <div className={styles.empty}>
              <Link size={22} className={styles.emptyIcon} />
              <p>No unlinked mentions found.</p>
              <p className={styles.emptyHint}>
                All character and location names are already linked, or none appear in this scene.
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
                <span className={styles.count}>
                  {proposals.length} suggestion{proposals.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className={styles.list}>
                {[
                  { label: "Characters", items: characters, type: "character" as const },
                  { label: "Locations", items: locations, type: "location" as const },
                ].map(
                  ({ label, items, type }) =>
                    items.length > 0 && (
                      <div key={type} className={styles.group}>
                        <p className={styles.groupLabel}>{label}</p>
                        {items.map((p) => {
                          const isSelected = selected.has(p.id);
                          const Icon = TYPE_ICON[p.entity_type];
                          const preview = LINK_PREVIEW[p.entity_type](p.entity_name);
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
                                <div className={styles.cardContent}>
                                  <div className={styles.cardMeta}>
                                    <Icon size={12} className={styles.typeIcon} />
                                    <span className={styles.entityName}>{p.entity_name}</span>
                                    {p.matched_text !== p.entity_name && (
                                      <span className={styles.matchedText}>matched "{p.matched_text}"</span>
                                    )}
                                    <ConfidenceDots value={p.confidence} />
                                  </div>
                                  <div className={styles.linkPreview}>
                                    <span className={styles.matchedRaw}>{p.matched_text}</span>
                                    <span className={styles.arrow}>→</span>
                                    <code className={styles.linkCode}>{preview}</code>
                                  </div>
                                  {p.source_excerpt && <p className={styles.excerpt}>{p.source_excerpt}</p>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ),
                )}
              </div>
            </>
          )}
        </div>

        {!loading && proposals.length > 0 && (
          <div className={styles.footer}>
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={applying || selectedCount === 0}
            >
              {applying ? "Applying…" : `Apply ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
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
