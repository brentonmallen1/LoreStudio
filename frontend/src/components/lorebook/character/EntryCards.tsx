import { useState } from "react";
import { Eye, EyeOff, MoreHorizontal, Trash2, X } from "lucide-react";
import { AREAS, FACET_FIELDS, FORMATIVE_FIELDS, KNOWN_LABELS } from "../../../lib/lorebook/whoAreThey";
import type { Facet, Formative, Known } from "../../../types";
import CommitInput from "../../common/CommitInput";
import PopoverMenu, { type MenuItem } from "../../common/PopoverMenu";
import FieldList from "../FieldList";
import styles from "./WhoAreThey.module.css";

interface Named {
  id: string;
  name: string;
}

/** What an entry card needs from the sheet around it. */
export interface EntryContext {
  /** The other characters, for who knows. */
  people: Named[];
  /** The book's scenes in reading order, for where the reader learns it. */
  scenes: Named[];
  /** Compendium entries, for a Body and mind entry's research. */
  research: Named[];
  /** The Assistant's switch shows only where AI does (D6). */
  aiAvailable: boolean;
}

type Patch<T> = (patch: Partial<T>) => void;

/** One Body and mind entry: its area and name, its paragraphs, who knows, its research. */
export function FacetCard({
  entry,
  ctx,
  onChange,
  onRemove,
  autoFocus,
}: {
  entry: Facet;
  ctx: EntryContext;
  onChange: Patch<Facet>;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const area = AREAS[entry.area];
  const listId = `facet-${entry.id}-names`;
  return (
    <article className={styles.entry} aria-label={entry.name || area.label}>
      <div className={styles.entryHead}>
        <span className={styles.entryArea}>{area.label}</span>
        <CommitInput
          className={styles.entryName}
          value={entry.name}
          placeholder="Name it in your words…"
          aria-label={`${area.label}: name`}
          list={area.suggestions.length ? listId : undefined}
          autoFocus={autoFocus}
          onCommit={(name) => onChange({ name })}
        />
        {area.suggestions.length > 0 && (
          <datalist id={listId}>
            {area.suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <EntryMenu entry={entry} ctx={ctx} onChange={onChange} onRemove={onRemove} />
      </div>
      <FieldList
        entityKey={entry.id}
        fields={FACET_FIELDS}
        values={entry as unknown as Record<string, unknown>}
        save={async (key, value) => onChange({ [key]: value } as Partial<Facet>)}
      />
      <div className={styles.meta}>
        <KnownControls entry={entry} ctx={ctx} onChange={onChange} />
        <span className={styles.break} />
        <ChipPicker
          label="Research"
          ids={entry.research}
          from={ctx.research}
          add="+ a Compendium entry"
          onChange={(research) => onChange({ research })}
        />
      </div>
    </article>
  );
}

/** One formative experience: what happened folded behind its content notes, what it did. */
export function FormativeCard({
  entry,
  ctx,
  onChange,
  onRemove,
  autoFocus,
}: {
  entry: Formative;
  ctx: EntryContext;
  onChange: Patch<Formative>;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(() => wasOpened(entry.id));
  const folded = entry.notes.length > 0 && !shown;
  const fields = folded ? FORMATIVE_FIELDS.filter((f) => f.key !== "what") : FORMATIVE_FIELDS;
  return (
    <article className={styles.entry} aria-label={entry.title || "A formative experience"}>
      <div className={styles.entryHead}>
        <CommitInput
          className={styles.entryName}
          value={entry.title}
          placeholder="Name it: an event, a time, a person…"
          aria-label="Formative experience: title"
          autoFocus={autoFocus}
          onCommit={(title) => onChange({ title })}
        />
        <EntryMenu entry={entry} ctx={ctx} onChange={onChange} onRemove={onRemove} />
      </div>
      {folded && (
        <div className={styles.folded}>
          <span>{entry.notes.join(", ")}</span>
          <button
            type="button"
            className={styles.foldBtn}
            onClick={() => {
              rememberOpened(entry.id);
              setShown(true);
            }}
          >
            Show what happened
          </button>
        </div>
      )}
      <FieldList
        entityKey={entry.id}
        fields={fields}
        values={entry as unknown as Record<string, unknown>}
        save={async (key, value) => onChange({ [key]: value } as Partial<Formative>)}
      />
      <div className={styles.meta}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={entry.wound}
            onChange={(e) => onChange({ wound: e.target.checked })}
          />
          The wound behind their arc
        </label>
        <span className={styles.break} />
        <KnownControls entry={entry} ctx={ctx} onChange={onChange} />
        <span className={styles.break} />
        <NotesInput notes={entry.notes} onChange={(notes) => onChange({ notes })} />
      </div>
    </article>
  );
}

/** ⋯ on an entry: keep it out of the Assistant (Studio only), or remove it. */
function EntryMenu({
  entry,
  ctx,
  onChange,
  onRemove,
}: {
  entry: Facet | Formative;
  ctx: EntryContext;
  onChange: Patch<Facet | Formative>;
  onRemove: () => void;
}) {
  const items: MenuItem[] = [
    ...(ctx.aiAvailable
      ? [
          {
            label: entry.assistant ? "Keep out of the Assistant" : "Let the Assistant use it",
            icon: entry.assistant ? EyeOff : Eye,
            ai: true,
            onSelect: () => onChange({ assistant: !entry.assistant }),
          },
        ]
      : []),
    { label: "Remove", icon: Trash2, danger: true, onSelect: onRemove },
  ];
  return (
    <>
      {ctx.aiAvailable && !entry.assistant && <span className={styles.aiTag}>Kept out of the Assistant</span>}
      <PopoverMenu label="More for this entry" trigger={<MoreHorizontal size={15} />} items={items} />
    </>
  );
}

/** Who knows it, and where the reader learns it. */
function KnownControls({
  entry,
  ctx,
  onChange,
}: {
  entry: Facet | Formative;
  ctx: EntryContext;
  onChange: Patch<Facet | Formative>;
}) {
  return (
    <>
      <select
        className={styles.select}
        aria-label="Who knows"
        value={entry.known}
        onChange={(e) => onChange({ known: e.target.value as Known })}
      >
        {(Object.keys(KNOWN_LABELS) as Known[]).map((k) => (
          <option key={k} value={k}>
            {KNOWN_LABELS[k]}
          </option>
        ))}
      </select>
      {entry.known === "some" && (
        <>
          <ChipPicker
            ids={entry.known_to}
            from={ctx.people}
            add="+ someone"
            onChange={(known_to) => onChange({ known_to })}
          />
          <CommitInput
            className={styles.noteInput}
            value={entry.known_note}
            placeholder="and anyone else: her doctor…"
            aria-label="Who else knows"
            onCommit={(known_note) => onChange({ known_note })}
          />
        </>
      )}
      <span className={styles.break} />
      <span className={styles.metaLabel}>The reader learns it in</span>
      <select
        className={styles.select}
        aria-label="The scene where the reader learns it"
        value={entry.revealed_in ?? ""}
        onChange={(e) => onChange({ revealed_in: e.target.value || null })}
      >
        <option value="">No scene chosen</option>
        {ctx.scenes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </>
  );
}

/** Chips for the chosen ones, and a select to add another. */
function ChipPicker({
  label,
  ids,
  from,
  add,
  onChange,
}: {
  label?: string;
  ids: string[];
  from: Named[];
  add: string;
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(from.map((n) => [n.id, n.name]));
  const rest = from.filter((n) => !ids.includes(n.id));
  return (
    <>
      {label && <span className={styles.metaLabel}>{label}</span>}
      {ids
        .filter((id) => byId.has(id))
        .map((id) => (
          <span key={id} className={styles.chip}>
            {byId.get(id)}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Remove ${byId.get(id)}`}
              onClick={() => onChange(ids.filter((x) => x !== id))}
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}
      {rest.length > 0 && (
        <select
          className={styles.select}
          aria-label={add.replace(/^\+ /, "Add ")}
          value=""
          onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
        >
          <option value="">{add}</option>
          {rest.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

/** Content notes: for the author only, so a hard entry is never met unprepared. */
function NotesInput({ notes, onChange }: { notes: string[]; onChange: (notes: string[]) => void }) {
  return (
    <>
      <span className={styles.metaLabel}>Content notes, for you only</span>
      {notes.map((n) => (
        <span key={n} className={styles.chip}>
          {n}
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={`Remove the note ${n}`}
            onClick={() => onChange(notes.filter((x) => x !== n))}
          >
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      <CommitInput
        className={styles.noteInput}
        value=""
        placeholder="grief, violence…"
        aria-label="Add content notes"
        onCommit={(text) => {
          const added = text
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t && !notes.includes(t));
          if (added.length) onChange([...notes, ...added]);
        }}
      />
    </>
  );
}

const OPENED = "ls_formative_opened";

/** Whether this viewer has opened a folded entry before: per browser, a convenience only. */
function wasOpened(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(OPENED) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}

function rememberOpened(id: string) {
  try {
    const seen = JSON.parse(localStorage.getItem(OPENED) ?? "[]") as string[];
    localStorage.setItem(OPENED, JSON.stringify([...new Set([...seen, id])].slice(-500)));
  } catch {
    // Site data blocked: it opens, it just forgets.
  }
}
