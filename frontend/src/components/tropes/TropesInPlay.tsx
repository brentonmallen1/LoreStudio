import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../../api/client";
import { sectionPath } from "../../lib/routes";
import { STANCES, stanceHint } from "../../lib/tropes/stances";
import { changeTropes, useTropes } from "../../lib/tropes/useTropes";
import { useTropeTargets } from "../../lib/tropes/useTropeTargets";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { Trope, TropeStance } from "../../types/tropes";
import CommitInput from "../common/CommitInput";
import CommitTextarea from "../common/CommitTextarea";
import styles from "./Tropes.module.css";

/**
 * Tropes in play (doc 27), on Story Identity: each trope the author knows the story is using,
 * what they mean to do with it, why, where it plays and the thread that tracks it. The
 * definition is reference and lives in the Compendium; this list is the author's intent.
 */
export default function TropesInPlay({ storyId }: { storyId: string }) {
  const { tropes } = useTropes(storyId);
  const [name, setName] = useState("");
  const { hash } = useLocation();
  const loaded = tropes !== null;

  // A link from a sheet, a scene or a finding names one trope: bring its row into view.
  useEffect(() => {
    if (loaded && hash.startsWith("#trope-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
    }
  }, [loaded, hash]);

  async function add() {
    const text = name.trim();
    if (!text) return;
    try {
      await changeTropes(api.createTrope(storyId, { name: text }));
      setName("");
    } catch {
      toast.error("The trope could not be added");
    }
  }

  if (!tropes) return null;
  return (
    <div className={styles.inPlay}>
      {tropes.length === 0 && (
        <p className={styles.quiet}>
          None yet. A trope is worth noting when you know what you mean to do with it: play it straight,
          subvert it, take it apart.
        </p>
      )}
      {tropes.map((t) => (
        <TropeRow key={t.id} storyId={storyId} trope={t} />
      ))}
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Name a trope in play…"
          aria-label="Name a trope in play"
        />
        <button type="button" className={styles.addBtn} onClick={() => void add()} disabled={!name.trim()}>
          <Plus size={13} aria-hidden /> Add
        </button>
      </div>
    </div>
  );
}

function TropeRow({ storyId, trope }: { storyId: string; trope: Trope }) {
  const threads = useStoryStore((s) => s.threads);
  const { groups, linkLabel, linkKey } = useTropeTargets(storyId);
  const placed = new Set(trope.links.map(linkKey));
  const shown = trope.links.map((lk) => ({ link: lk, label: linkLabel(lk) })).filter((x) => x.label !== null);

  async function run(p: Promise<unknown>, failed: string) {
    try {
      await changeTropes(p);
    } catch {
      toast.error(failed);
    }
  }

  async function addDefinition() {
    try {
      const entry = await api.createCompendiumNote(storyId, {
        title: trope.name,
        tags: ["Trope"],
        category: "craft",
      });
      await changeTropes(api.updateTrope(trope.id, { definition_id: entry.id }));
    } catch {
      toast.error("The definition could not be added");
    }
  }

  return (
    <div className={styles.row} id={`trope-${trope.id}`}>
      <div className={styles.head}>
        <CommitInput
          className={styles.name}
          value={trope.name}
          aria-label="Trope name"
          onCommit={(text) =>
            text.trim() &&
            void run(api.updateTrope(trope.id, { name: text.trim() }), "The name could not be saved")
          }
        />
        <select
          className={styles.stance}
          aria-label={`What you do with ${trope.name}`}
          title={stanceHint(trope.stance)}
          value={trope.stance}
          onChange={(e) =>
            void run(
              api.updateTrope(trope.id, { stance: e.target.value as TropeStance }),
              "The stance could not be saved",
            )
          }
        >
          {STANCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Delete ${trope.name}`}
          title="Delete this trope"
          onClick={() => void run(api.deleteTrope(trope.id), "The trope could not be deleted")}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>

      <CommitTextarea
        className={styles.why}
        value={trope.why}
        placeholder="What you mean to do with it, and why"
        aria-label={`Why ${trope.name}`}
        onCommit={(why) => void run(api.updateTrope(trope.id, { why }), "The note could not be saved")}
      />

      <div className={styles.line}>
        <span className={styles.label}>Plays in</span>
        <div className={styles.chips}>
          {shown.length === 0 && <span className={styles.quiet}>the whole story</span>}
          {shown.map(({ link, label }) => (
            <span key={link.id} className={styles.chip}>
              {label}
              <button
                type="button"
                className={styles.chipX}
                aria-label={`Take ${trope.name} out of ${label}`}
                onClick={() => void run(api.removeTropeLink(link.id), "That could not be removed")}
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <select
            className={styles.place}
            aria-label={`Where ${trope.name} plays`}
            value=""
            onChange={(e) => {
              const target = groups.flatMap((g) => g.items).find((i) => i.key === e.target.value)?.target;
              if (target) void run(api.addTropeLink(trope.id, target), "That could not be added");
            }}
          >
            <option value="">+ Where it plays</option>
            {groups.map((g) =>
              g.items.length ? (
                <optgroup key={g.label} label={g.label}>
                  {g.items
                    .filter((i) => !placed.has(i.key))
                    .map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.label}
                      </option>
                    ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>
      </div>

      <div className={styles.line}>
        <span className={styles.label}>Tracked by</span>
        <select
          className={styles.place}
          aria-label={`The thread that tracks ${trope.name}`}
          value={trope.thread_id ?? ""}
          onChange={(e) =>
            void run(
              api.updateTrope(trope.id, { thread_id: e.target.value || null }),
              "The thread could not be saved",
            )
          }
        >
          <option value="">No thread</option>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {trope.thread_id && (
          <Link to={sectionPath(storyId, "promises", "threads", trope.thread_id)} className={styles.link}>
            Open the thread
          </Link>
        )}
        <span className={styles.spacer} />
        {trope.definition_id ? (
          <Link
            to={sectionPath(storyId, "compendium", "research", trope.definition_id)}
            className={styles.link}
          >
            The definition
          </Link>
        ) : (
          <button type="button" className={styles.linkBtn} onClick={() => void addDefinition()}>
            Add a definition
          </button>
        )}
      </div>
    </div>
  );
}
