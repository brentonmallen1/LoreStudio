import { ArrowLeft, ArrowRight, TriangleAlert } from "lucide-react";
import {
  FACET_LABELS,
  SNIPPET_TARGETS,
  TARGETS,
  choiceOf,
  choose,
  groupEntries,
  optionsFor,
  plural,
  tally,
} from "../../lib/import/novelcrafter";
import { useMode } from "../../lib/mode";
import type {
  EntryTarget,
  NcEntry,
  NovelcrafterChoices,
  NovelcrafterPreview,
  SnippetTarget,
} from "../../types/novelcrafter";
import styles from "./WhatComesOverStep.module.css";

const LABEL = new Map(TARGETS.map((t) => [t.value, t.label]));

/**
 * What comes over (doc 28): every codex entry, snippet and conversation in a Novelcrafter
 * export, where each will go, and a menu to send it elsewhere. Below them, what has no place
 * in LoreStudio and what the file never had, so nothing goes missing without the author
 * reading about it first.
 */
export default function WhatComesOverStep({
  preview,
  choices,
  onChange,
  onBack,
  onNext,
}: {
  preview: NovelcrafterPreview;
  choices: NovelcrafterChoices;
  onChange: (next: NovelcrafterChoices) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const studio = useMode() === "studio";
  const names = new Map(preview.entries.map((e) => [e.id, e.name]));
  const groups = groupEntries(preview, choices);
  const t = tally(preview, choices);
  const later = groups.find((g) => g.target === "later");

  const setEntry = (entry: NcEntry, target: EntryTarget) =>
    onChange({ ...choices, entries: { ...choices.entries, [entry.id]: choose(entry, target) } });
  const setSnippet = (id: string, target: SnippetTarget) =>
    onChange({ ...choices, snippets: { ...choices.snippets, [id]: target } });
  const setAllLater = (target: EntryTarget) => {
    if (!later) return;
    const entries = { ...choices.entries };
    for (const e of later.entries) entries[e.id] = choose(e, target);
    onChange({ ...choices, entries });
  };

  const where = (e: NcEntry) => {
    const c = choiceOf(e, choices);
    if (c.target === "facet" && c.facet_of)
      return `${names.get(c.facet_of)}'s ${FACET_LABELS[c.facet_field ?? "note"]}`;
    if (c.target === "merge" && c.merge_into) return names.get(c.merge_into);
    return null;
  };

  return (
    <div className={styles.root}>
      <p className={styles.lead}>
        {plural(t.entries, "codex entry", "codex entries")}, {plural(preview.snippets.length, "snippet")}
        {studio && `, ${plural(preview.chats.length, "conversation")}`}. {t.home} have a home
        {t.later > 0 && `, ${t.later} wait for you to decide`}
        {t.left > 0 && `, ${t.left} stay behind`}. Change any of it below.
      </p>

      <div className={styles.options}>
        {preview.looks_like_screenplay && (
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={choices.screenplay}
              onChange={(e) => onChange({ ...choices, screenplay: e.target.checked })}
            />
            <span>
              <strong>Import as a screenplay.</strong> The manuscript has scene headings and character cues;
              each line becomes the script element it reads as. Leave this off to keep it as prose.
            </span>
          </label>
        )}
        {studio && preview.chats.length > 0 && (
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={choices.chats}
              onChange={(e) => onChange({ ...choices, chats: e.target.checked })}
            />
            <span>
              <strong>Bring the {plural(preview.chats.length, "AI conversation")} into the Chronicle,</strong>{" "}
              marked as from Novelcrafter.
            </span>
          </label>
        )}
        {!studio && preview.chats.length > 0 && (
          <p className={styles.quiet}>
            {plural(preview.chats.length, "AI conversation")} are left out in Writer mode. They stay in the
            original file.
          </p>
        )}
      </div>

      {groups.map((g) => (
        <section key={g.target} className={styles.group} aria-label={g.label}>
          <h3 className={styles.heading}>
            {g.label} <span className={styles.count}>{g.entries.length}</span>
            {g.target === "later" && (
              <select
                className={styles.bulk}
                aria-label="Send everything waiting to"
                value=""
                onChange={(e) => e.target.value && setAllLater(e.target.value as EntryTarget)}
              >
                <option value="">Send all of these to…</option>
                {["compendium", "note", "skip"].map((v) => (
                  <option key={v} value={v}>
                    {LABEL.get(v as EntryTarget)}
                  </option>
                ))}
              </select>
            )}
          </h3>
          {g.target === "later" && (
            <p className={styles.quiet}>
              These wait in Discoveries › Imported, where you can make each one a character, a place, a note
              or anything else, keep it in the Compendium, or let it go.
            </p>
          )}
          <ul className={styles.rows}>
            {g.entries.map((e) => (
              <li key={e.id} className={styles.row}>
                <div className={styles.what}>
                  <span className={styles.name}>{e.name}</span>
                  {where(e) && <span className={styles.into}>into {where(e)}</span>}
                  {e.excerpt && <span className={styles.excerpt}>{e.excerpt}</span>}
                  {e.clash_text && (
                    <span className={styles.clash}>
                      <TriangleAlert size={12} aria-hidden /> {e.clash_text}
                    </span>
                  )}
                </div>
                <select
                  className={styles.target}
                  aria-label={`Where ${e.name} goes`}
                  value={choiceOf(e, choices).target}
                  onChange={(ev) => setEntry(e, ev.target.value as EntryTarget)}
                >
                  {optionsFor(e).map((v) => (
                    <option key={v} value={v}>
                      {v === "merge" && e.clash_with ? `Into ${names.get(e.clash_with)}` : LABEL.get(v)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {preview.snippets.length > 0 && (
        <section className={styles.group} aria-label="Snippets">
          <h3 className={styles.heading}>
            Snippets <span className={styles.count}>{preview.snippets.length}</span>
          </h3>
          <ul className={styles.rows}>
            {preview.snippets.map((s) => (
              <li key={s.id} className={styles.row}>
                <div className={styles.what}>
                  <span className={styles.name}>{s.title || "Untitled snippet"}</span>
                  {s.excerpt && <span className={styles.excerpt}>{s.excerpt}</span>}
                </div>
                <select
                  className={styles.target}
                  aria-label={`Where ${s.title || "this snippet"} goes`}
                  value={choices.snippets[s.id] ?? s.target}
                  onChange={(ev) => setSnippet(s.id, ev.target.value as SnippetTarget)}
                >
                  {SNIPPET_TARGETS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(preview.no_place.length > 0 || preview.nothing_set.length > 0) && (
        <section className={styles.group} aria-label="No place in LoreStudio">
          <h3 className={styles.heading}>No place in LoreStudio</h3>
          <ul className={styles.facts}>
            {preview.no_place.map((x) => (
              <li key={x.what}>
                <strong>{x.what}</strong>
                {x.examples.length > 0 && <span className={styles.excerpt}> on {x.examples.join(", ")}</span>}
                <span className={styles.why}>{x.why}</span>
              </li>
            ))}
          </ul>
          {preview.nothing_set.length > 0 && (
            <p className={styles.quiet}>
              {preview.nothing_set.join(", ")}: none were set, so there is nothing to lose.
            </p>
          )}
        </section>
      )}

      <section className={styles.group} aria-label="Not in the file">
        <h3 className={styles.heading}>Not in the file</h3>
        <p className={styles.quiet}>
          Novelcrafter's export leaves these out; copy anything you need before you close it.
        </p>
        <ul className={styles.facts}>
          {preview.not_in_file.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <div className={styles.footer}>
        <button type="button" onClick={onBack} className={styles.backBtn}>
          <ArrowLeft size={13} aria-hidden /> Back
        </button>
        <button type="button" onClick={onNext} className={styles.nextBtn}>
          Continue <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
