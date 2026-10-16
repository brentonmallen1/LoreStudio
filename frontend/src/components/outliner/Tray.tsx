import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal } from "lucide-react";
import { placeSpots, type PlaceSpot } from "../../lib/outline/place";
import { shapeOf } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import type { TrayItem } from "../../types";
import PopoverMenu from "../common/PopoverMenu";
import { ideaDrag, type Tray as TrayState } from "./useTray";
import styles from "./Tray.module.css";

/**
 * The Outline's Not placed yet tray (doc 29 D3, B-Outline): ideas for what should happen, not
 * tied to a scene yet. Jot one by typing; drag it into the List or the Cards when you know
 * where it goes, or use Place it… to choose the spot from the keyboard. At full width it is a
 * column beside the Outline; narrow, a fold above it; beside the prose, a compact section.
 */
export default function Tray({
  tray,
  fold = false,
  compact = false,
}: {
  tray: TrayState;
  /** Narrow: the tray folds, open when it has nothing in it yet. */
  fold?: boolean;
  /** Beside the prose: a short section under the Outline's lines. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const [over, setOver] = useState<{ id: string; below: boolean } | null>(null);
  const shown = !fold || (open ?? tray.items.length === 0);
  const count = tray.items.length;

  function dropOn(e: DragEvent, item: TrayItem) {
    const from = ideaDrag.get();
    if (!from || from.id === item.id) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const below = e.clientY - rect.top > rect.height / 2;
    if (e.type === "dragover") {
      if (over?.id !== item.id || over.below !== below) setOver({ id: item.id, below });
      return;
    }
    setOver(null);
    const at = tray.items.findIndex((i) => i.id === item.id);
    const fromAt = tray.items.findIndex((i) => i.id === from.id);
    const to = at + (below ? 1 : 0) - (fromAt < at ? 1 : 0);
    void tray.move(from.id, to);
  }

  return (
    <aside className={styles.tray} data-compact={compact || undefined} aria-label="Not placed yet">
      {fold ? (
        <button
          type="button"
          className={styles.foldHead}
          aria-expanded={shown}
          onClick={() => setOpen(!shown)}
        >
          {shown ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <span className={styles.title}>Not placed yet</span>
          {count > 0 && <span className={styles.count}>{count}</span>}
        </button>
      ) : (
        <h2 className={styles.title}>
          Not placed yet{compact && count > 0 && <span className={styles.count}> · {count}</span>}
        </h2>
      )}
      {shown && (
        <>
          {!compact && (
            <p className={styles.why}>
              Ideas for things that should happen, not tied to a scene. Drag one into the outline when you
              know where it goes, or use Place it.
            </p>
          )}
          {count > 0 && (
            <ul className={styles.items} onDragLeave={() => setOver(null)}>
              {tray.items.map((item, i) => (
                <Idea
                  key={item.id}
                  item={item}
                  tray={tray}
                  index={i}
                  compact={compact}
                  drop={over?.id === item.id ? (over.below ? "below" : "above") : undefined}
                  onDrag={(e) => dropOn(e, item)}
                />
              ))}
            </ul>
          )}
          <Jot onJot={tray.add} />
        </>
      )}
    </aside>
  );
}

function Jot({ onJot }: { onJot: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await onJot(t);
  };
  return (
    <input
      className={styles.jot}
      value={text}
      placeholder="Jot an idea…"
      aria-label="Jot an idea for the tray"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void send();
        }
        if (e.key === "Escape") setText("");
      }}
      onBlur={() => void send()}
    />
  );
}

function Idea({
  item,
  tray,
  index,
  compact,
  drop,
  onDrag,
}: {
  item: TrayItem;
  tray: TrayState;
  index: number;
  compact: boolean;
  drop?: "above" | "below";
  onDrag: (e: DragEvent) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const last = tray.items.length - 1;
  return (
    <li
      className={styles.idea}
      data-drop={drop}
      draggable={!renaming && !placing}
      onDragStart={(e) => {
        ideaDrag.set(item);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.text);
      }}
      onDragEnd={() => {
        ideaDrag.set(null);
      }}
      onDragOver={onDrag}
      onDrop={onDrag}
    >
      <div className={styles.ideaLine}>
        {!compact && (
          <span className={styles.grip} aria-hidden title="Drag into the outline, or up and down the tray">
            <GripVertical size={12} />
          </span>
        )}
        {renaming ? (
          <Rename
            text={item.text}
            onDone={(text) => {
              setRenaming(false);
              if (text && text !== item.text) void tray.rename(item.id, text);
            }}
          />
        ) : (
          <span className={styles.ideaText} onDoubleClick={() => setRenaming(true)}>
            {item.text}
          </span>
        )}
        <PopoverMenu
          label={`More for “${item.text}”`}
          trigger={<MoreHorizontal size={14} />}
          items={[
            ...(compact ? [{ label: "Place it…", onSelect: () => setPlacing(true) }] : []),
            { label: "Rename", onSelect: () => setRenaming(true) },
            { label: "Move up", onSelect: () => void tray.move(item.id, index - 1), disabled: index === 0 },
            {
              label: "Move down",
              onSelect: () => void tray.move(item.id, index + 1),
              disabled: index === last,
            },
            { label: "Delete", danger: true, onSelect: () => void tray.remove(item.id) },
          ]}
        />
      </div>
      {item.notes && !compact && <p className={styles.ideaNotes}>{item.notes}</p>}
      {placing ? (
        <PlacePicker item={item} tray={tray} onClose={() => setPlacing(false)} />
      ) : (
        !compact && (
          <button type="button" className={styles.placeIt} onClick={() => setPlacing(true)}>
            Place it…
          </button>
        )
      )}
    </li>
  );
}

function Rename({ text, onDone }: { text: string; onDone: (text: string) => void }) {
  const done = useRef(false);
  const finish = (value: string) => {
    if (done.current) return;
    done.current = true;
    onDone(value.trim());
  };
  return (
    <textarea
      autoFocus
      className={styles.rename}
      defaultValue={text}
      rows={2}
      aria-label="Rename the idea"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => finish(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(e.currentTarget.value);
        }
        if (e.key === "Escape") finish(text);
      }}
    />
  );
}

/** Where the idea goes, chosen from a list: the keyboard's way to do what a drag does. */
function PlacePicker({ item, tray, onClose }: { item: TrayItem; tray: TrayState; onClose: () => void }) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const spots = placeSpots(structure, shapeOf(template));
  const [key, setKey] = useState(spots.at(-1)?.key ?? "");
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => select.current?.focus(), []);
  const groups = spots.reduce<Map<string, PlaceSpot[]>>(
    (m, s) => m.set(s.group, [...(m.get(s.group) ?? []), s]),
    new Map(),
  );

  if (!spots.length)
    return (
      <div className={styles.picker} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <p className={styles.pickerNone}>
          Nothing in the Outline holds scenes yet. Add a chapter, then place ideas in it.
        </p>
        <button type="button" className={styles.placeBtn} onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    );
  return (
    <div className={styles.picker} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <label className={styles.pickerLabel}>
        Where does it go?
        <select ref={select} className={styles.select} value={key} onChange={(e) => setKey(e.target.value)}>
          {[...groups].map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className={styles.pickerButtons}>
        <button
          type="button"
          className={styles.placeBtn}
          onClick={async () => {
            const spot = spots.find((s) => s.key === key);
            if (spot && (await tray.place(item.id, spot))) return;
            onClose();
          }}
        >
          Place it as a planned scene
        </button>
        <button type="button" className={styles.placeBtn} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
