import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../../api/client";
import { usePromises } from "../../lib/promises/usePromises";
import { SETUP_TYPES, setupSentence, setupType } from "../../lib/promises/setups";
import { toast } from "../../stores/toastStore";
import PageHeader from "../layout/PageHeader";
import SetupsAcross from "../series/SetupsAcross";
import styles from "./Promises.module.css";

/**
 * Setups and payoffs (doc 18 C3): every scene link, earlier scene first. Foreshadowing and
 * callbacks are promises too: something planted that a later scene pays off or returns to.
 */
export default function SetupsSection({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { data, reload } = usePromises(storyId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("foreshadowing");
  const [note, setNote] = useState("");
  const scenes = data?.scenes ?? [];
  const title = (id: string) => scenes.find((s) => s.id === id)?.title ?? "a scene";
  const go = (id: string) => navigate(`/stories/${storyId}/write/${id}`);
  const scene = (id: string) => (
    <button type="button" className={styles.sceneLink} onClick={() => go(id)}>
      {title(id)}
    </button>
  );

  async function add() {
    try {
      await api.createSceneLink({
        story_id: storyId,
        source_node_id: from,
        target_node_id: to,
        link_type: type,
        note,
      });
      setFrom("");
      setTo("");
      setNote("");
      await reload();
    } catch {
      toast.error("Could not link those scenes");
    }
  }

  async function remove(id: string) {
    await api.deleteSceneLink(id);
    await reload();
  }

  const setups = data?.setups ?? [];
  return (
    <div className={styles.page}>
      <PageHeader
        title="Setups and payoffs"
        summary={
          setups.length
            ? `${setups.length} ${setups.length === 1 ? "link" : "links"} between scenes`
            : "What one scene plants and a later one pays off"
        }
      />
      <div className={styles.body}>
        <p className={styles.intro}>
          A setup is a promise too: a detail, a line or an image that a later scene pays off or returns to.
          Link the two scenes here or from either scene, and the tapestry draws them.
        </p>
        <section className={styles.card} aria-label="Every setup">
          {setups.length === 0 ? (
            <p className={styles.quiet}>
              No setups yet. Link the scene that plants something to the one that pays it off.
            </p>
          ) : (
            <div className={styles.list}>
              {setups.map((s) => {
                const t = setupType(s.link_type);
                return (
                  <div key={s.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        <span className={styles.tag} title={t.hint}>
                          {t.label}
                        </span>{" "}
                        {t.laterFirst ? scene(s.to_node_id) : scene(s.from_node_id)} {t.verb}{" "}
                        {t.laterFirst ? scene(s.from_node_id) : scene(s.to_node_id)}
                      </span>
                      {s.note && <span className={styles.rowNote}>{s.note}</span>}
                    </div>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Remove: ${setupSentence(s.link_type, title(s.from_node_id), title(s.to_node_id))}`}
                      title="Remove this link"
                      onClick={() => void remove(s.id)}
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {data && <SetupsAcross storyId={storyId} data={data} reload={reload} />}
        {scenes.length > 1 && (
          <section className={styles.card} aria-label="Link two scenes">
            <h2 className={styles.cardTitle}>Link two scenes</h2>
            <div className={styles.form}>
              <select aria-label="The earlier scene" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">This scene…</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <select aria-label="How they are linked" value={type} onChange={(e) => setType(e.target.value)}>
                {SETUP_TYPES.map((t) => (
                  <option key={t.value} value={t.value} title={t.hint}>
                    {t.label.toLowerCase()}
                  </option>
                ))}
              </select>
              <select aria-label="The later scene" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">…this scene</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <input
                aria-label="What links them"
                placeholder="What links them (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!from || !to || from === to}
                onClick={() => void add()}
              >
                Link them
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
