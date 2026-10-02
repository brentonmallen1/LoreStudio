import { useState } from "react";
import { api } from "../../api/client";
import { rankByName } from "../../lib/mentions/otherNames";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { Character, Location } from "../../types";
import styles from "./MentionFixer.module.css";

type Entry = Character | Location;

/**
 * A mention that names nobody, and what to do about it: it is someone (or somewhere) the
 * Lorebook already has under another name, so the words become one of their names; it is
 * someone new, so they are added; or it was never meant as a mention, so the link goes and
 * the words stay. The prose is not rewritten to fit the Lorebook.
 */
export default function MentionFixer({
  type,
  name,
  storyId,
  onUnlink,
  onDone,
}: {
  type: "character" | "setting";
  name: string;
  storyId: string;
  onUnlink?: () => void;
  onDone: () => void;
}) {
  const isChar = type === "character";
  const characters = useStoryStore((s) => s.characters);
  const locations = useStoryStore((s) => s.locations);
  const upsertCharacter = useStoryStore((s) => s.upsertCharacter);
  const upsertLocation = useStoryStore((s) => s.upsertLocation);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const pool: Entry[] = isChar ? characters : locations.filter((l) => !l.is_stub);
  const ranked = rankByName(name, pool);
  const best = ranked[0] && ranked[0].score >= 2 ? ranked[0].item : null;
  const q = query.trim().toLowerCase();
  const shown = (q ? ranked.filter((r) => r.item.name.toLowerCase().includes(q)) : ranked).slice(0, 8);

  async function run(job: () => Promise<string>) {
    setBusy(true);
    try {
      toast.success(await job());
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work; try again.");
    } finally {
      setBusy(false);
    }
  }

  function sameAs(entry: Entry) {
    void run(async () => {
      const aliases = [...(entry.aliases ?? []), name];
      if (isChar) upsertCharacter(await api.updateCharacter(entry.id, { aliases }));
      else upsertLocation(await api.updateLocation(entry.id, { aliases }));
      return `“${name}” is now another name for ${entry.name}`;
    });
  }

  function add() {
    void run(async () => {
      if (isChar) upsertCharacter(await api.createCharacter(storyId, { name }));
      else upsertLocation(await api.createLocation(storyId, { name }));
      return `${name} added to ${isChar ? "Characters" : "Places"}`;
    });
  }

  return (
    <div className={styles.fixer}>
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <span className={styles.badge}>{isChar ? "Not in Characters" : "Not in Places"}</span>
      </div>
      <div className={styles.actions}>
        {best && (
          <button type="button" className={styles.primary} disabled={busy} onClick={() => sameAs(best)}>
            Same as {best.name}
          </button>
        )}
        {pool.length > 0 && (
          <button
            type="button"
            className={styles.btn}
            aria-expanded={picking}
            disabled={busy}
            onClick={() => setPicking((p) => !p)}
          >
            {best ? (isChar ? "Someone else…" : "Somewhere else…") : "Same as…"}
          </button>
        )}
        <button type="button" className={styles.btn} disabled={busy} onClick={add}>
          {isChar ? "Add as a character" : "Add to Places"}
        </button>
        {onUnlink && (
          <button
            type="button"
            className={styles.quiet}
            disabled={busy}
            title="Keep the words and drop the link"
            onClick={() => {
              onUnlink();
              onDone();
            }}
          >
            Unlink
          </button>
        )}
      </div>
      {picking && (
        <div className={styles.pick}>
          <input
            autoFocus
            className={styles.find}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown[0]) sameAs(shown[0].item);
            }}
            placeholder={isChar ? "Find a character" : "Find a place"}
            aria-label={isChar ? "Find a character" : "Find a place"}
          />
          <ul className={styles.list}>
            {shown.map(({ item }) => (
              <li key={item.id}>
                <button type="button" disabled={busy} onClick={() => sameAs(item)}>
                  {item.name}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className={styles.none}>Nothing by that name</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
