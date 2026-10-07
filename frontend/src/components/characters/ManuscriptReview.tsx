import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Orbit, Pencil, Square } from "lucide-react";
import { characterReviewApi, type Review, type ReviewItem } from "../../api/characterReview";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useAIAvailable } from "../../lib/mode";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../llm";
import { QUICK_MISSES, byScene, describeChange, initiallyTicked, marked } from "../../lib/characters/review";
import { toast } from "../../stores/toastStore";
import type { Character } from "../../types";
import { Modal } from "../common";
import styles from "./ManuscriptReview.module.css";

/** What Careful's verdict means for a sentence, said under it. */
const CAREFUL_NOTE = {
  theirs: "The Assistant read these as theirs.",
  partly: "The Assistant read some of these as theirs: check each word.",
  not: "The Assistant read these as someone else's.",
};

export interface ReviewChange {
  pronouns?: [string, string];
  name?: [string, string];
}

/**
 * The review step (doc 20 P3): a character's new pronouns or name, followed through the prose
 * one sentence at a time. Sure ones start ticked; nothing is written until Apply, which makes
 * every ticked sentence and the character's own field one change, undone with one Undo, after
 * a named version is saved. With no change it is "Review pronouns…": slips that follow their name.
 */
export default function ManuscriptReview({
  character,
  storyId,
  change,
  onDone,
  onClose,
}: {
  character: Character;
  storyId: string;
  /** Null: a review for slips, against the pronouns they have now. */
  change: ReviewChange | null;
  onDone: (saved: Character) => void;
  onClose: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [hand, setHand] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [about, setAbout] = useState(false);
  const aiAvailable = useAIAvailable();
  const transparency = useLLMTransparency();
  const [asking, setAsking] = useState<AbortController | null>(null);
  const [asked, setAsked] = useState(false);

  const request = change
    ? { pronouns_from: change.pronouns?.[0], pronouns_to: change.pronouns?.[1] }
    : { slips: true };

  /** Careful: ask the Assistant about the scenes Quick was unsure of, and take its word for them. */
  async function askCareful() {
    if (!review) return;
    const nodeIds = [
      ...new Set(review.items.filter((i) => i.kind === "pronoun" && !i.sure).map((i) => i.node_id)),
    ];
    const controller = new AbortController();
    setAsking(controller);
    try {
      const { judged } = await characterReviewApi.careful(
        character.id,
        { ...request, node_ids: nodeIds },
        controller.signal,
      );
      const verdicts = new Map(judged.map((j) => [j.item_id, j.verdict]));
      setReview({
        ...review,
        items: review.items.map((i) => {
          const v = verdicts.get(i.id);
          if (!v) return i;
          return { ...i, careful: true, sure: v === "theirs", note: CAREFUL_NOTE[v] };
        }),
      });
      setTicked((t) => {
        const next = new Set(t);
        for (const [id, v] of verdicts) {
          if (v === "theirs") next.add(id);
          else next.delete(id);
        }
        return next;
      });
      setAsked(true);
      transparency.recordInteraction();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        toast.error("The Assistant could not read the scenes");
    } finally {
      setAsking(null);
    }
  }

  useEffect(() => {
    const body = change
      ? {
          pronouns_from: change.pronouns?.[0],
          pronouns_to: change.pronouns?.[1],
          name_from: change.name?.[0],
          name_to: change.name?.[1],
        }
      : { slips: true };
    characterReviewApi
      .review(character.id, body)
      .then((r) => {
        setReview(r);
        setTicked(initiallyTicked(r.items));
      })
      .catch(() => setFailed(true));
  }, [character.id, change]);

  const groups = review ? byScene(review) : [];
  const changes = review?.items.filter((i) => i.edits.length > 0) ?? [];
  const sure = changes.filter((i) => i.sure).length;

  async function apply(items: ReviewItem[]) {
    setApplying(true);
    try {
      const seen = Object.fromEntries((review?.scenes ?? []).map((s) => [s.node_id, s.updated_at]));
      const result = await characterReviewApi.apply(character.id, {
        pronouns: change?.pronouns?.[1],
        name: change?.name?.[1],
        items: items.map((i) => ({ ...i, hand: hand[i.id] })),
        seen,
      });
      const said = [
        result.applied ? `${result.applied} ${result.applied === 1 ? "change" : "changes"} made` : "",
        result.skipped.length ? `left alone, written in since: ${result.skipped.join(", ")}` : "",
        result.not_placed
          ? `${result.not_placed} not made, the words had moved or run across formatting`
          : "",
      ].filter(Boolean);
      toast.success(said.length ? said.join("; ") : `${character.name} updated`);
      onDone(result.character);
    } catch {
      toast.error("The review could not be applied");
      setApplying(false);
    }
  }

  const title = change ? "Review the manuscript" : `Review ${character.name}'s pronouns`;
  const toApply = changes.filter((i) => ticked.has(i.id));
  const what = change ? describeChange(change) : "";

  return (
    <Modal
      isOpen
      // Closing a change's review keeps the change, as Skip does: the author saved it.
      onClose={change ? () => void apply([]) : onClose}
      title={title}
      icon={<Pencil size={15} />}
      size="xl"
      footer={
        <>
          {change ? (
            <button
              type="button"
              className={styles.secondary}
              disabled={applying}
              onClick={() => void apply([])}
            >
              Skip: change{" "}
              {change.pronouns && change.name ? "them" : change.pronouns ? "the pronouns" : "the name"} only
            </button>
          ) : (
            <button type="button" className={styles.secondary} onClick={onClose}>
              Close
            </button>
          )}
          <button
            type="button"
            className={styles.primary}
            disabled={applying || !review || (!change && toApply.length === 0)}
            onClick={() => void apply(toApply)}
          >
            {applying
              ? "Applying…"
              : toApply.length
                ? `Apply ${toApply.length} ${toApply.length === 1 ? "change" : "changes"}`
                : "Apply"}
          </button>
        </>
      }
    >
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <div className={styles.body}>
        <div className={styles.head}>
          <p className={styles.lede}>
            {change ? (
              <>
                <strong>{character.name}</strong>: {what}. Each sentence below would change with it. Tick what
                should; Apply makes them and the change one Undo, after saving a version of the story.
              </>
            ) : (
              <>
                Sentences where a pronoun other than {character.pronouns || "theirs"} follows {character.name}
                's name. Tick what should change.
              </>
            )}
          </p>
          {aiAvailable &&
            review &&
            (asking || asked || review.items.some((i) => i.kind === "pronoun" && !i.sure)) && (
              <div className={styles.careful}>
                {asking ? (
                  <button type="button" className={styles.carefulBtn} onClick={() => asking.abort()}>
                    <Square size={12} aria-hidden /> Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.carefulBtn}
                    disabled={asked}
                    title="The Assistant reads the scenes Quick was unsure of and says which pronouns are theirs"
                    onClick={() => void askCareful()}
                  >
                    <Orbit size={13} aria-hidden /> {asked ? "Careful: asked" : "Careful, with the Assistant"}
                  </button>
                )}
                {asked && (
                  <LLMTransparencyTrigger
                    onClick={() =>
                      transparency.open({ context_type: "attributes", character_id: character.id }, "", {
                        feature: "pronoun-identification",
                        character_id: character.id,
                      })
                    }
                  />
                )}
              </div>
            )}
          <div className={styles.tier}>
            <span className={styles.tierName}>Quick, on this machine</span>
            <button
              type="button"
              className={styles.about}
              aria-label="What Quick will miss"
              title="What Quick will miss"
              onClick={() => setAbout((v) => !v)}
              aria-expanded={about}
            >
              <Info size={14} aria-hidden />
            </button>
          </div>
        </div>
        {about && (
          <div className={styles.misses}>
            <p>
              Quick reads each scene with a small language model on this machine. It finds pronouns and the
              verbs they govern, but it cannot tell for certain who a pronoun means. It will miss:
            </p>
            <ul>
              {QUICK_MISSES.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {failed && <p className={styles.note}>The manuscript could not be read. Try again in a moment.</p>}
        {!review && !failed && <p className={styles.note}>Reading the manuscript…</p>}
        {review?.unsupported && <p className={styles.note}>{review.unsupported}</p>}
        {review && groups.length === 0 && (
          <p className={styles.note}>
            {change
              ? "No sentence needs to change."
              : "No slips found: every pronoun after their name is theirs."}
          </p>
        )}
        {review && changes.length > 0 && (
          <p className={styles.count}>
            {changes.length} {changes.length === 1 ? "sentence" : "sentences"} in {groups.length}{" "}
            {groups.length === 1 ? "scene" : "scenes"}: {sure} sure, {changes.length - sure} unsure. Sure ones
            are ticked.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.nodeId} className={styles.scene} aria-label={g.title}>
            <div className={styles.sceneHead}>
              <h3 className={styles.sceneTitle}>{g.title}</h3>
              <Link className={styles.open} to={`/stories/${storyId}/write/${g.nodeId}`} onClick={onClose}>
                Open the scene
              </Link>
            </div>
            {g.items.map((item) =>
              item.kind === "gendered" ? (
                <div key={item.id} className={styles.row} data-kind="gendered">
                  <span className={styles.tag}>No rewrite</span>
                  <div className={styles.sentence}>
                    <p>{item.before}</p>
                    <p className={styles.was}>
                      A gendered word: “{item.note}”. Change it in the scene if it should change.
                    </p>
                  </div>
                </div>
              ) : (
                <div key={item.id} className={styles.row}>
                  <input
                    type="checkbox"
                    aria-label={`Change: ${item.after}`}
                    checked={ticked.has(item.id)}
                    onChange={(e) =>
                      setTicked((t) => {
                        const next = new Set(t);
                        if (e.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <div className={styles.sentence}>
                    {editing === item.id ? (
                      <HandEdit
                        initial={hand[item.id] ?? item.after}
                        onDone={(text) => {
                          setEditing(null);
                          if (text !== item.after) {
                            setHand((h) => ({ ...h, [item.id]: text }));
                            setTicked((t) => new Set(t).add(item.id));
                          }
                        }}
                      />
                    ) : (
                      <p>
                        {hand[item.id] ??
                          marked(item).map((piece, i) => (
                            <Fragment key={i}>
                              {piece.changed ? <mark>{piece.text}</mark> : piece.text}
                            </Fragment>
                          ))}
                      </p>
                    )}
                    <p className={styles.was}>was: {item.before}</p>
                    {item.careful && <p className={styles.carefulNote}>{item.note}</p>}
                  </div>
                  <span className={styles.tag} data-sure={item.sure || undefined}>
                    {item.kind === "name" ? "Name" : item.sure ? "Sure" : "Unsure"}
                  </span>
                  <button
                    type="button"
                    className={styles.edit}
                    aria-label="Write this sentence by hand"
                    title="Write this sentence by hand"
                    onClick={() => setEditing(item.id)}
                  >
                    <Pencil size={13} aria-hidden />
                  </button>
                </div>
              ),
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}

/** A sentence written by hand in place of the proposal: kept when you leave it, Escape drops it. */
function HandEdit({ initial, onDone }: { initial: string; onDone: (text: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <textarea
      autoFocus
      rows={2}
      className={styles.handInput}
      aria-label="The sentence, by hand"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onDone(text.trim() || initial)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone(initial);
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
