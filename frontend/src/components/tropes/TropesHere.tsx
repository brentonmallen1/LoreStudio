import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { sectionPath } from "../../lib/routes";
import { stanceHint, stanceLabel } from "../../lib/tropes/stances";
import { changeTropes, tropesAt, useTropes } from "../../lib/tropes/useTropes";
import { useTropeTargets } from "../../lib/tropes/useTropeTargets";
import { toast } from "../../stores/toastStore";
import type { TropeLinkTarget } from "../../types/tropes";
import CommitTextarea from "../common/CommitTextarea";
import styles from "./Tropes.module.css";

type Place = { characterId: string } | { relationshipId: string } | { nodeId: string };

function targetOf(place: Place): TropeLinkTarget {
  if ("nodeId" in place) return { node_id: place.nodeId };
  if ("relationshipId" in place) return { relationship_id: place.relationshipId };
  return { character_id: place.characterId };
}

/**
 * The tropes that play at one place (doc 27): a character (alone, or in a relationship they
 * are in), a relationship, or a scene. Each opens its row on Story Identity; one played here
 * directly can be taken out, and on a scene it carries a note of what happens to it there.
 * `notes` shows that note.
 */
export default function TropesHere({
  storyId,
  place,
  notes = false,
}: {
  storyId: string;
  place: Place;
  notes?: boolean;
}) {
  const { tropes } = useTropes(storyId);
  const { relationshipsOf } = useTropeTargets(storyId);
  if (!tropes) return null;
  const target = targetOf(place);
  const where =
    "nodeId" in place
      ? { nodeId: place.nodeId }
      : "relationshipId" in place
        ? { relationshipIds: [place.relationshipId] }
        : { characterId: place.characterId, relationshipIds: relationshipsOf(place.characterId) };
  const here = tropesAt(tropes, where);
  const others = tropes.filter((t) => !here.includes(t));
  const direct = (linkTarget: (typeof here)[number]["links"][number]) =>
    ("node_id" in target && linkTarget.node_id === target.node_id) ||
    ("character_id" in target && linkTarget.character_id === target.character_id) ||
    ("relationship_id" in target && linkTarget.relationship_id === target.relationship_id);

  async function run(p: Promise<unknown>, failed: string) {
    try {
      await changeTropes(p);
    } catch {
      toast.error(failed);
    }
  }

  return (
    <div className={styles.here}>
      {here.length === 0 && <p className={styles.quiet}>No trope plays here.</p>}
      {here.map((t) => {
        const link = t.links.find(direct);
        return (
          <div key={t.id} className={styles.hereItem}>
            <div className={styles.hereHead}>
              <Link
                to={`${sectionPath(storyId, "lorebook", "identity")}#trope-${t.id}`}
                className={styles.hereName}
                title={t.why || stanceHint(t.stance)}
              >
                {t.name}
              </Link>
              <span className={styles.hereStance}>{stanceLabel(t.stance)}</span>
              {link && (
                <button
                  type="button"
                  className={styles.chipX}
                  aria-label={`Take ${t.name} out of here`}
                  title="Take this trope out of here"
                  onClick={() => void run(api.removeTropeLink(link.id), "That could not be removed")}
                >
                  <X size={11} aria-hidden />
                </button>
              )}
            </div>
            {notes && link && (
              <CommitTextarea
                className={styles.why}
                value={link.note}
                placeholder="What happens to it here?"
                aria-label={`Note on ${t.name} here`}
                onCommit={(note) =>
                  void run(api.updateTropeLink(link.id, note), "The note could not be saved")
                }
              />
            )}
          </div>
        );
      })}
      {others.length > 0 && (
        <label className={styles.chips}>
          <Plus size={13} aria-hidden />
          <select
            className={styles.place}
            aria-label="Play a trope here"
            value=""
            onChange={(e) =>
              e.target.value && void run(api.addTropeLink(e.target.value, target), "That could not be added")
            }
          >
            <option value="">Play a trope here</option>
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {tropes.length === 0 && (
        <Link to={sectionPath(storyId, "lorebook", "identity")} className={styles.link}>
          Name the tropes in play on Story Identity
        </Link>
      )}
    </div>
  );
}
