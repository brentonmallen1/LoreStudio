import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { splitFields, type FieldSpec } from "../../lib/lorebook/kinds";
import { useAutosaveField } from "../plan/useAutosaveField";
import styles from "./Lorebook.module.css";

/**
 * A sheet's text fields under "empty is quiet" (doc 12 D3): what is written reads as text
 * and becomes a box only while you edit it; what is not written is one word in an Add row.
 * A field emptied and left goes back to the row.
 */
export default function FieldList({
  entityKey,
  fields,
  values,
  save,
}: {
  /** Changes when the sheet shows another entry, so the fields start over. */
  entityKey: string;
  fields: FieldSpec[];
  values: Record<string, unknown>;
  save: (key: string, value: string) => Promise<unknown>;
}) {
  // What the author typed here, ahead of the store catching up, so a field moves between
  // the text and the Add row the moment it is filled or emptied.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState(entityKey);
  if (lastKey !== entityKey) {
    setLastKey(entityKey);
    setTyped({});
    setEditing(null);
  }

  const merged = { ...values, ...typed };
  const { filled, empty } = splitFields(fields, merged);
  const shown =
    editing && !filled.some((f) => f.key === editing)
      ? [...filled, fields.find((f) => f.key === editing)!]
      : filled;
  const rest = empty.filter((f) => f.key !== editing);

  return (
    <div className={styles.fields}>
      {shown.map((f) => (
        <FieldBlock
          key={`${entityKey}:${f.key}`}
          id={`field-${entityKey}-${f.key}`}
          field={f}
          value={String(merged[f.key] ?? "")}
          editing={editing === f.key}
          onEdit={() => setEditing(f.key)}
          onDone={() => setEditing((cur) => (cur === f.key ? null : cur))}
          save={(v) => {
            setTyped((t) => ({ ...t, [f.key]: v }));
            return save(f.key, v);
          }}
        />
      ))}
      {rest.length > 0 && (
        <div className={styles.addRow} aria-label="Add a field">
          <span className={styles.addRowLabel}>Add</span>
          {rest.map((f) => (
            <button key={f.key} type="button" className={styles.addChip} onClick={() => setEditing(f.key)}>
              <Plus size={11} aria-hidden />
              {f.name ?? f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldBlock({
  id,
  field,
  value,
  editing,
  onEdit,
  onDone,
  save,
}: {
  /** Unique on the page: a sheet can hold several lists (an entry card's own fields). */
  id: string;
  field: FieldSpec;
  value: string;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  save: (value: string) => Promise<unknown>;
}) {
  const auto = useAutosaveField(value, save);
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    const el = input.current;
    el?.focus();
    el?.setSelectionRange?.(el.value.length, el.value.length);
  }, [editing]);

  const listId = field.options ? `${id}-options` : undefined;
  const finish = () => {
    auto.flush();
    onDone();
  };

  if (!editing) {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <div
          className={field.short ? styles.fieldTextShort : styles.fieldText}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${field.label}`}
          title="Click to edit"
          onClick={onEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit();
            }
          }}
        >
          {auto.value}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {field.label}
      </label>
      {field.short ? (
        <>
          <input
            ref={input}
            id={id}
            className={styles.fieldInput}
            value={auto.value}
            placeholder={field.hint}
            list={listId}
            onChange={(e) => auto.change(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                finish();
              }
            }}
          />
          {field.options && (
            <datalist id={listId}>
              {field.options.map((o) =>
                typeof o === "string" ? (
                  <option key={o} value={o} />
                ) : (
                  <option key={o.value} value={o.value} label={`${o.value} (${o.note})`} />
                ),
              )}
            </datalist>
          )}
        </>
      ) : (
        <textarea
          ref={input}
          id={id}
          className={styles.fieldArea}
          value={auto.value}
          placeholder={field.hint}
          rows={Math.min(12, Math.max(3, Math.ceil(auto.value.length / 70) + 1))}
          onChange={(e) => auto.change(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              finish();
            }
          }}
        />
      )}
    </div>
  );
}
