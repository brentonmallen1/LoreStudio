import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Undo2 } from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";
import type { FiledKind, IdeaFragment } from "../../types/planning";
import { newFragment, splitIntoFragments, suggestNames } from "../../lib/planning/ideas";
import { FILE_KINDS, fileFragment, type FileChoice } from "./fileFragment";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { ideasApi, type SuggestedName } from "../../api/planning";
import styles from "./IdeaView.module.css";

/** Where a filed piece went, as a link the author can follow. */
function filedPath(storyId: string, filed: NonNullable<IdeaFragment["filed"]>): string | null {
  switch (filed.kind) {
    case "character":
      return `/stories/${storyId}/lorebook/characters/${filed.ref_id}`;
    case "place":
      return `/stories/${storyId}/lorebook/places/${filed.ref_id}`;
    case "scene":
      return `/stories/${storyId}/write?node=${filed.ref_id}`;
    case "question":
      return null;
    default:
      return `/stories/${storyId}/lorebook`;
  }
}

/**
 * Start from an idea (refactor doc 10 P2). Write everything you know in any order, then
 * sort it: each piece you file becomes part of the story (a character, a place, a scene,
 * a question...) and moves out of the way, so the page gets shorter as the story forms.
 */
export default function IdeaView({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory, characters } = useStoryStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [draft, setDraft] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    api
      .listLocationsFlat(storyId)
      .then(setLocations)
      .catch(() => {});
  }, [storyId]);
  useReloadOnUndo(["story"], () => api.getStory(storyId).then(setActiveStory));

  const fragments = activeStory?.idea_fragments ?? [];
  const unsorted = fragments.filter((f) => !f.filed);
  const filed = fragments.filter((f) => f.filed);
  const knownNames = [...characters.map((c) => c.name), ...locations.map((l) => l.name)];

  // Names the story lacks, from the server's spaCy pass; null falls back to the
  // capitalised-word heuristic (a failed request, or before the first answer).
  const [suggested, setSuggested] = useState<Record<string, SuggestedName[]> | null>(null);
  const suggestKey = `${unsorted.map((f) => `${f.id}:${f.text}`).join("\n")}|${knownNames.join(",")}`;
  useEffect(() => {
    if (!unsorted.length) return;
    const texts = Object.fromEntries(unsorted.map((f) => [f.id, f.text]));
    const timer = setTimeout(() => {
      ideasApi
        .names(storyId, texts)
        .then((r) => setSuggested(r.names))
        .catch(() => setSuggested(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [suggestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeStory) return null;

  /** Show the change at once; keep only the server's answer to the latest save. */
  async function save(next: IdeaFragment[]) {
    const story = useStoryStore.getState().activeStory;
    if (!story) return;
    const mine = ++seq.current;
    setActiveStory({ ...story, idea_fragments: next });
    const saved = await api.updateStory(storyId, { idea_fragments: next });
    if (mine === seq.current) setActiveStory(saved);
  }

  function current(): IdeaFragment[] {
    return useStoryStore.getState().activeStory?.idea_fragments ?? [];
  }

  function add() {
    const pieces = splitIntoFragments(draft);
    if (!pieces.length) return;
    const now = new Date().toISOString();
    setDraft("");
    void save([...current(), ...pieces.map((p) => newFragment(p, now, crypto.randomUUID()))]);
  }

  function patch(id: string, change: Partial<IdeaFragment>) {
    void save(current().map((f) => (f.id === id ? { ...f, ...change } : f)));
  }

  return (
    <div className={styles.view}>
      <div className={styles.main}>
        <p className={styles.intro}>
          Write everything you know about this story, in any order: people, places, moments, the feeling
          you're after, what you don't know yet. Then sort it. Each piece you file becomes part of the story
          and moves out of the way.
        </p>
        <div className={styles.capture}>
          <textarea
            className={styles.captureInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (matchesCombo(e, SHORTCUTS.submitText.combo)) {
                e.preventDefault();
                add();
              }
            }}
            rows={5}
            placeholder="A lighthouse keeper who hasn't left the island in five years…"
            aria-label="Write an idea"
            autoFocus={fragments.length === 0}
          />
          <div className={styles.captureFoot}>
            <span>
              {formatCombo(SHORTCUTS.submitText.combo)} adds it. A paste becomes one piece per paragraph (or
              per line).
            </span>
            <button className={styles.primaryBtn} onClick={add} disabled={!draft.trim()}>
              Add
            </button>
          </div>
        </div>

        {unsorted.length > 0 && (
          <section className={styles.section} aria-label="To sort">
            <h3 className={styles.sectionTitle}>
              To sort <span className={styles.count}>{unsorted.length}</span>
            </h3>
            <ul className={styles.fragments}>
              {unsorted.map((f) => (
                <FragmentRow
                  key={f.id}
                  storyId={storyId}
                  fragment={f}
                  knownNames={knownNames}
                  suggested={suggested?.[f.id]}
                  locations={locations}
                  onText={(text) => patch(f.id, { text })}
                  onFiled={(result) => patch(f.id, { filed: result })}
                  onDelete={() => void save(current().filter((x) => x.id !== f.id))}
                />
              ))}
            </ul>
          </section>
        )}
        {unsorted.length === 0 && fragments.length > 0 && (
          <p className={styles.allSorted}>Everything is sorted. Add more whenever something comes to you.</p>
        )}

        {filed.length > 0 && (
          <details className={styles.filed}>
            <summary>Filed ({filed.length})</summary>
            <ul className={styles.filedList}>
              {filed.map((f) => {
                const path = filedPath(storyId, f.filed!);
                return (
                  <li key={f.id} className={styles.filedItem}>
                    <p className={styles.filedText}>{f.text}</p>
                    <span className={styles.filedAs}>
                      {FILE_KINDS.find((k) => k.kind === f.filed!.kind)?.label}:{" "}
                      {path ? <Link to={path}>{f.filed!.label}</Link> : f.filed!.label}
                    </span>
                    <button
                      className={styles.iconBtn}
                      title="Back to sort (what it made stays)"
                      aria-label="Move back to sort"
                      onClick={() => patch(f.id, { filed: null })}
                    >
                      <Undo2 size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  storyId: string;
  fragment: IdeaFragment;
  knownNames: string[];
  suggested?: SuggestedName[];
  locations: Location[];
  onText: (text: string) => void;
  onFiled: (filed: NonNullable<IdeaFragment["filed"]>) => void;
  onDelete: () => void;
}

function FragmentRow({
  storyId,
  fragment,
  knownNames,
  suggested,
  locations,
  onText,
  onFiled,
  onDelete,
}: RowProps) {
  const [text, setText] = useState(fragment.text);
  const [kind, setKind] = useState<FiledKind | null>(null);
  const [prefill, setPrefill] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  const names: SuggestedName[] =
    suggested ?? suggestNames(text, knownNames).map((name) => ({ name, kind: "character" as const }));

  function open(k: FiledKind, value = "") {
    setKind((current) => (current === k && !value ? null : k));
    setPrefill(value);
  }

  return (
    <li className={styles.fragment}>
      <textarea
        ref={ref}
        className={styles.fragmentText}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== fragment.text && text.trim() && onText(text.trim())}
        rows={1}
        aria-label="Idea"
      />
      <div className={styles.actions}>
        <span className={styles.fileLabel}>File as</span>
        {FILE_KINDS.map((k) => (
          <button
            key={k.kind}
            className={`${styles.fileBtn} ${kind === k.kind ? styles.fileBtnActive : ""}`}
            title={k.hint}
            onClick={() => open(k.kind)}
          >
            {k.label}
          </button>
        ))}
        <button
          className={styles.iconBtn}
          title="Delete this piece"
          aria-label="Delete this piece"
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {names.length > 0 && !kind && (
        <div className={styles.suggest}>
          <span>New names:</span>
          {names.slice(0, 4).map((n) => (
            <button
              key={n.name}
              className={styles.nameChip}
              title={`File as a ${n.kind === "place" ? "place" : "character"} named ${n.name}`}
              onClick={() => open(n.kind, n.name)}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}
      {kind && (
        <FileForm
          key={`${kind}-${prefill}`}
          storyId={storyId}
          fragment={{ ...fragment, text: text.trim() || fragment.text }}
          kind={kind}
          prefill={prefill}
          names={names}
          locations={locations}
          onCancel={() => setKind(null)}
          onFiled={onFiled}
        />
      )}
    </li>
  );
}

interface FormProps {
  storyId: string;
  fragment: IdeaFragment;
  kind: FiledKind;
  prefill: string;
  names: SuggestedName[];
  locations: Location[];
  onCancel: () => void;
  onFiled: (filed: NonNullable<IdeaFragment["filed"]>) => void;
}

function firstWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  return (
    words
      .slice(0, n)
      .join(" ")
      .replace(/[.,;:!?]+$/, "") + (words.length > n ? "…" : "")
  );
}

/** The one question a filing needs answered, if any: which character, what title… */
function FileForm({ storyId, fragment, kind, prefill, names, locations, onCancel, onFiled }: FormProps) {
  const { characters, activeStory } = useStoryStore();
  const initial =
    kind === "character" || kind === "place"
      ? prefill || names.find((n) => n.kind === kind)?.name || ""
      : kind === "scene"
        ? firstWords(fragment.text, 6)
        : kind === "theme"
          ? fragment.text.split(/\s+/).length <= 4
            ? fragment.text
            : ""
          : "";
  const [value, setValue] = useState(initial);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(choice: FileChoice) {
    setBusy(true);
    setError(null);
    try {
      onFiled(await fileFragment(storyId, fragment, choice));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work; try again.");
      setBusy(false);
    }
  }

  function submit() {
    switch (kind) {
      case "character":
        return target
          ? go({ kind, name: "", existingId: target })
          : value.trim() && go({ kind, name: value });
      case "place": {
        const existing = locations.find((l) => l.id === target);
        return existing ? go({ kind, name: "", existing }) : value.trim() && go({ kind, name: value });
      }
      case "scene":
        return go({ kind, title: value });
      case "theme":
        return value.trim() && go({ kind, theme: value });
      case "question":
        return go({ kind });
      default:
        return go({ kind });
    }
  }

  const fieldValue =
    kind === "logline"
      ? activeStory?.logline
      : kind === "premise"
        ? activeStory?.premise
        : activeStory?.central_conflict;
  const existingOptions = kind === "character" ? characters : kind === "place" ? locations : [];

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {(kind === "character" || kind === "place" || kind === "scene" || kind === "theme") && (
        <input
          autoFocus
          className={styles.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setTarget("");
          }}
          placeholder={
            kind === "character"
              ? "New character's name"
              : kind === "place"
                ? "New place's name"
                : kind === "scene"
                  ? "Scene title"
                  : "The theme, in a word or two"
          }
          aria-label={kind === "scene" ? "Scene title" : `${kind} name`}
        />
      )}
      {existingOptions.length > 0 && (
        <select
          className={styles.input}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label={`Or add to an existing ${kind}`}
        >
          <option value="">{kind === "character" ? "…or add to a character" : "…or add to a place"}</option>
          {existingOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      {kind === "question" && <span className={styles.formNote}>It goes on the list of open questions.</span>}
      {(kind === "logline" || kind === "premise" || kind === "conflict") && (
        <span className={styles.formNote}>
          {fieldValue?.trim()
            ? kind === "logline"
              ? `Replaces the current logline: “${firstWords(fieldValue, 12)}”`
              : "Added as a new paragraph after what's there."
            : `Becomes the story's ${kind === "conflict" ? "central conflict" : kind}.`}
        </span>
      )}
      <button type="submit" className={styles.primaryBtn} disabled={busy}>
        File it
      </button>
      <button type="button" className={styles.quietBtn} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
