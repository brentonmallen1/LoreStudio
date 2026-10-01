import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { knowledgeApi, type CharacterKnowledge } from "../../api/knowledge";
import type { KnowledgeScope } from "../../types";
import styles from "./CharacterKnowledgeDrawer.module.css";

/**
 * "What they know" — the scenes this character was present for and the facts they hold,
 * as of the interview's story point. This is the same list the persona prompt receives,
 * shown to the author so the boundary is inspectable rather than implied (doc 06 §6).
 */
export default function CharacterKnowledgeDrawer({
  characterId,
  characterName,
  asOfNodeId,
  scope,
  onClose,
}: {
  characterId: string;
  characterName: string;
  asOfNodeId: string | null;
  scope: KnowledgeScope;
  onClose: () => void;
}) {
  const [data, setData] = useState<CharacterKnowledge | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    knowledgeApi
      .forCharacter(characterId, asOfNodeId, scope)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [characterId, asOfNodeId, scope]);

  return (
    <div className={styles.drawer} role="dialog" aria-label={`What ${characterName} knows`}>
      <div className={styles.head}>
        <Eye size={13} className={styles.icon} />
        <span className={styles.title}>What {characterName} knows</span>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>

      {failed && <p className={styles.note}>Could not load what this character knows.</p>}
      {!failed && !data && <p className={styles.note}>Loading…</p>}

      {data?.mode === "profile" && (
        <p className={styles.summary}>
          This interview happens outside the story. {characterName} is themselves (history, voice, what they
          want), but knows none of the plot, and will say so if you ask about it.
        </p>
      )}

      {data && data.mode !== "profile" && (
        <>
          <p className={styles.summary}>
            Present for {data.scenes.length} of {data.scenes_considered} scene
            {data.scenes_considered === 1 ? "" : "s"}
            {data.as_of_title ? ` up to ${data.as_of_title}` : " written so far"}. They will say they were not
            there if you ask about anything else.
          </p>

          {data.scenes.length === 0 ? (
            <p className={styles.note}>
              No scene records them yet. Set a point of view, attribute their dialogue, or name them in the
              prose and they will appear here.
            </p>
          ) : (
            <ul className={styles.list}>
              {data.scenes.map((s) => (
                <li key={s.node_id} className={styles.item}>
                  <span className={styles.sceneTitle}>{s.title}</span>
                  <span className={styles.reasons}>{s.reasons.join(" · ")}</span>
                  {s.summary && <span className={styles.sceneSummary}>{s.summary}</span>}
                </li>
              ))}
            </ul>
          )}

          {data.facts.length > 0 && (
            <>
              <p className={styles.sectionTitle}>Facts they hold</p>
              <ul className={styles.list}>
                {data.facts.map((f, i) => (
                  <li key={i} className={styles.item}>
                    <span className={styles.sceneTitle}>
                      {f.subject}
                      {!f.is_truth && <span className={styles.false}> believed, not true</span>}
                    </span>
                    {f.detail && <span className={styles.sceneSummary}>{f.detail}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
