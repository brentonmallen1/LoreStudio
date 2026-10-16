import { useState } from "react";
import { Link } from "react-router-dom";
import { proposalsApi } from "../../../api/proposals";
import { api } from "../../../api/client";
import { slotVar } from "../../../lib/colorSlots";
import { sectionPath } from "../../../lib/routes";
import { reloadCharacters } from "../../../lib/story/loadStory";
import { useProposalsStore } from "../../../stores/proposalsStore";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import type { NamedCount, NewName } from "../../../types/written";
import styles from "./Written.module.css";

/** Names shown before "and N more in the Lorebook". */
const SHOWN = 8;
/** New names offered here; the rest wait in Discoveries. */
const NEW_SHOWN = 2;

/** "1 more new name waits in", "3 more new places wait in". */
const waiting = (n: number, people: boolean) =>
  `${n} more new ${people ? "name" : "place"}${n === 1 ? " waits" : "s wait"} in`;

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/**
 * People (or places) you've written about (doc 29 D6): each by how often the prose names them,
 * a click from their sheet, and the names the prose uses that the Lorebook does not have yet,
 * from Discoveries' name scan, with its yes and no.
 */
export default function NamedHere({
  storyId,
  kind,
  named,
  fresh,
  onAnswered,
}: {
  storyId: string;
  kind: "person" | "place";
  named: NamedCount[];
  fresh: NewName[];
  onAnswered: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const people = kind === "person";
  const section = people ? "characters" : "places";
  const heading = people ? "People you've written about" : "Places you've written about";
  const id = `written-${section}`;

  /** A yes (an action's id) or a no (null). */
  async function answer(n: NewName, action: string | null) {
    setBusy(n.proposal_id);
    try {
      if (action) await proposalsApi.act(storyId, n.proposal_id, action);
      else await proposalsApi.decline(storyId, n.proposal_id);
      // A name asked as either became what its action said, whichever list it showed in.
      const person = action === "person" || (action !== "place" && people);
      if (action && person) await reloadCharacters();
      if (action && !person) useStoryStore.getState().setLocations(await api.listLocationsFlat(storyId));
      void useProposalsStore.getState().refetch();
      onAnswered();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work; try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.part} aria-labelledby={id}>
      <h3 id={id} className={styles.heading}>
        {heading}
      </h3>
      {named.length === 0 ? (
        <p className={styles.quiet}>
          {people
            ? "No one from your Lorebook is named in the prose yet."
            : "No place from your Lorebook is named in the prose yet."}
        </p>
      ) : (
        <ul className={styles.chips}>
          {named.slice(0, SHOWN).map((c) => (
            <li key={c.id}>
              <Link
                to={sectionPath(storyId, "lorebook", section, c.id)}
                className={styles.chip}
                title={`Named ${times(c.times)}${people ? `, in ${c.scenes} ${c.scenes === 1 ? "scene" : "scenes"}` : ""}`}
              >
                <span
                  className={styles.slot}
                  style={{ background: slotVar(c.color_slot ?? 0) }}
                  aria-hidden
                />
                {c.name}
                <span className={styles.count}>· {c.times.toLocaleString()}</span>
              </Link>
            </li>
          ))}
          {named.length > SHOWN && (
            <li>
              <Link to={sectionPath(storyId, "lorebook", section)} className={styles.chip}>
                and {named.length - SHOWN} more
              </Link>
            </li>
          )}
        </ul>
      )}
      {fresh.slice(0, NEW_SHOWN).map((n) => (
        <div key={n.proposal_id} className={styles.newName}>
          <span className={styles.newText}>
            <strong>“{n.name}”</strong> turns up {times(n.times)} but isn't in your Lorebook.
          </span>
          <span className={styles.actions}>
            {n.actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className={styles.secondary}
                disabled={busy === n.proposal_id}
                onClick={() => void answer(n, a.id)}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              className={styles.secondary}
              disabled={busy === n.proposal_id}
              onClick={() => void answer(n, null)}
            >
              {n.decline}
            </button>
          </span>
        </div>
      ))}
      {fresh.length > NEW_SHOWN && (
        <p className={styles.quiet}>
          {waiting(fresh.length - NEW_SHOWN, people)}{" "}
          <Link to={`/stories/${storyId}/discoveries`} className={styles.link}>
            Discoveries
          </Link>
          .
        </p>
      )}
    </section>
  );
}
