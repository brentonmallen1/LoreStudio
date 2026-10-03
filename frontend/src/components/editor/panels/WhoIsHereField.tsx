import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { codexApi, type ScenePresenceRow } from "../../../api/codex";
import type { StructureNode } from "../../../types";
import styles from "../SceneEditor.module.css";

const smallSelect: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontFamily: "inherit",
  padding: "0.15rem 0.3rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};

const ROLES = [
  { value: "pov", label: "Point of view" },
  { value: "participant", label: "In the scene" },
  { value: "mentioned", label: "Talked about" },
  { value: "absent", label: "Not here" },
];

/** How the Codex worked it out, said plainly. */
const BASIS_LABELS: Record<string, string> = {
  pov: "point of view",
  dialogue: "speaks here",
  mention: "named in the prose",
  inferred: "suggested",
  manual: "you said so",
};

/**
 * "Who is here" (doc 07 §3) — the author's answer to a question the derivation can only
 * guess at.
 *
 * The Codex reads point of view, dialogue tags and names in the prose. Only the author
 * knows whether a name in a paragraph is someone in the room or someone being talked
 * about, and "Not here" is the useful answer: it is what stops a character being
 * interviewed about a scene they were only discussed in.
 */
export default function WhoIsHereField({
  activeNode,
  storyId,
}: {
  activeNode: StructureNode;
  storyId: string;
}) {
  const [rows, setRows] = useState<ScenePresenceRow[] | null>(null);
  const [synced, setSynced] = useState(true);
  const [adding, setAdding] = useState("");

  const load = useCallback(() => {
    codexApi
      .presence(storyId, activeNode.id)
      .then((data) => {
        setSynced(data.synced);
        setRows(data.characters);
      })
      .catch(() => setRows([]));
  }, [storyId, activeNode.id]);

  useEffect(load, [load]);

  async function setRole(characterId: string, role: string) {
    await codexApi.setPresence(storyId, activeNode.id, characterId, role);
    load();
  }

  if (rows === null) return null;

  if (!synced) {
    return (
      <div className={styles.overviewField}>
        <div className={styles.linkedHeader}>
          <label className={styles.overviewLabel}>Who is here</label>
        </div>
        <p className={styles.overviewHint}>
          The Codex has not been built for this story yet. Build it from Settings › Codex and this scene's
          cast will appear here.
        </p>
      </div>
    );
  }

  const here = rows.filter((r) => r.role && r.role !== "absent");
  const elsewhere = rows.filter((r) => !r.role || r.role === "absent");

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>Who is here</label>
        {elsewhere.length > 0 && (
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            <select
              aria-label="Add someone"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              style={smallSelect}
            >
              <option value="">Add someone…</option>
              {elsewhere.map((r) => (
                <option key={r.character_id} value={r.character_id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              aria-label="Add this character"
              className={styles.addLinkBtn}
              disabled={!adding}
              onClick={async () => {
                await setRole(adding, "participant");
                setAdding("");
              }}
            >
              <Plus size={11} />
            </button>
          </div>
        )}
      </div>
      {here.length === 0 ? (
        <p className={styles.overviewHint}>
          Nobody yet. The Codex reads point of view, dialogue and names in the prose. If you write around
          names, add people here so their interviews know they were in this scene.
        </p>
      ) : (
        <div className={styles.linkChips}>
          {here.map((row) => (
            <div key={row.character_id} className={styles.linkChip}>
              <span className={styles.linkChipContent} style={{ cursor: "default" }}>
                <span className={styles.linkChipTitle}>{row.name}</span>
                {row.basis && (
                  <span className={styles.linkChipLabel}>{BASIS_LABELS[row.basis] ?? row.basis}</span>
                )}
              </span>
              <select
                value={row.role ?? "absent"}
                onChange={(e) => setRole(row.character_id, e.target.value)}
                style={smallSelect}
                aria-label={`${row.name}'s part in this scene`}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
