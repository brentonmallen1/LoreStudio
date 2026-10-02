import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, PanelRight, Tag } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import SlotPicker from "../common/SlotPicker";
import AlsoCalled from "./AlsoCalled";
import type { SceneRef } from "../../lib/lorebook/presence";
import styles from "./Lorebook.module.css";

export interface SheetView {
  id: string;
  label: string;
}

/**
 * One sheet for every Lorebook entry (doc 12 P2, D2): a colour dot, the name, a few badges,
 * where it is in the book with its scenes one click away, then the entry's own body — its
 * written fields on the left and what it is connected to on the right. The compact sheet in
 * the side panel is the top half of this; "Open beside the page" puts it there.
 */
export default function EntitySheet({
  entityKey,
  name,
  onRename,
  startRenaming = false,
  dot,
  slot,
  badges,
  alsoCalled,
  presence,
  scenes = [],
  onOpenBeside,
  more = [],
  views,
  view,
  onView,
  aside,
  children,
  side,
  footer,
}: {
  entityKey: string;
  name: string;
  onRename?: (name: string) => Promise<unknown>;
  /** A new entry: the name is selected, ready to type over. */
  startRenaming?: boolean;
  /** A CSS colour for the dot, or null for an outlined one. */
  dot: string | null;
  /** The entry's palette slot, when it has one: the dot becomes its colour picker. */
  slot?: { value: number; onChange: (slot: number) => void };
  badges?: ReactNode;
  /** A character's or place's other names, the ones mentions in the prose may use. */
  alsoCalled?: { names: string[]; onChange: (names: string[]) => void };
  presence?: string;
  scenes?: SceneRef[];
  onOpenBeside?: () => void;
  more?: MenuItem[];
  views?: SheetView[];
  view?: string;
  onView?: (id: string) => void;
  /** Beside the name: a portrait, a colour picker. */
  aside?: ReactNode;
  children: ReactNode;
  /** The right column: connections, clues, the arc. */
  side?: ReactNode;
  /** Under the body, full width: the Assistant row. */
  footer?: ReactNode;
}) {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const shownScenes = scenes.length > 6 ? scenes.slice(0, 5) : scenes;
  const [addingName, setAddingName] = useState(false);
  const menu: MenuItem[] = alsoCalled
    ? [...more, { label: "Add another name…", icon: Tag, onSelect: () => setAddingName(true) }]
    : more;

  return (
    <article className={styles.sheet} aria-label={name}>
      <header className={styles.sheetHeader}>
        {slot ? (
          <DotPicker dot={dot} slot={slot} name={name} />
        ) : (
          <span
            className={styles.sheetDot}
            style={dot ? { background: dot, borderColor: dot } : undefined}
            aria-hidden
          />
        )}
        <div className={styles.sheetTitleBlock}>
          <div className={styles.sheetTitleRow}>
            <EditableName key={entityKey} name={name} onRename={onRename} start={startRenaming} />
            {badges}
          </div>
          {alsoCalled && (
            <AlsoCalled
              names={alsoCalled.names}
              adding={addingName}
              onAdding={setAddingName}
              onChange={alsoCalled.onChange}
            />
          )}
          {presence && <div className={styles.presence}>{presence}</div>}
          {scenes.length > 0 && (
            <div className={styles.sceneChips}>
              {shownScenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.sceneChip}
                  onClick={() => navigate(`/stories/${storyId}/write/${s.id}`)}
                  title={`Open ${s.title}`}
                >
                  {s.title}
                </button>
              ))}
              {scenes.length > shownScenes.length && (
                <span className={styles.sceneMore}>+{scenes.length - shownScenes.length} more</span>
              )}
            </div>
          )}
        </div>
        {aside}
        {onOpenBeside && (
          <button
            type="button"
            className={styles.sheetBtn}
            onClick={onOpenBeside}
            title="Keep it open beside the page"
            aria-label="Open beside the page"
          >
            <PanelRight size={13} aria-hidden />
            <span className={styles.sheetBtnLabel}>Open beside the page</span>
          </button>
        )}
        <PopoverMenu label={`More for ${name}`} trigger={<MoreHorizontal size={15} />} items={menu} />
      </header>

      {views && views.length > 1 && (
        <div className={styles.sheetViews} role="tablist" aria-label={`${name} views`}>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === view}
              className={`${styles.sheetView} ${v.id === view ? styles.sheetViewOn : ""}`}
              onClick={() => onView?.(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className={side ? styles.sheetBody : styles.sheetBodySingle}>
        <div className={styles.sheetMain}>{children}</div>
        {side && <aside className={styles.sheetSide}>{side}</aside>}
      </div>
      {footer}
    </article>
  );
}

/** The colour dot, which opens the eight palette slots. */
function DotPicker({
  dot,
  slot,
  name,
}: {
  dot: string | null;
  slot: { value: number; onChange: (slot: number) => void };
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className={styles.dotWrap}>
      <button
        type="button"
        className={`${styles.sheetDot} ${styles.sheetDotBtn}`}
        style={dot ? { background: dot, borderColor: dot } : undefined}
        aria-label={`${name}'s colour`}
        aria-expanded={open}
        title="Colour"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className={styles.dotPopover}>
          <SlotPicker
            size="sm"
            label={`${name}'s colour`}
            value={slot.value}
            onChange={(v) => {
              slot.onChange(v);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function EditableName({
  name,
  onRename,
  start,
}: {
  name: string;
  onRename?: (name: string) => Promise<unknown>;
  start: boolean;
}) {
  const [editing, setEditing] = useState(start);
  const [draft, setDraft] = useState(name);
  if (!onRename) return <h2 className={styles.sheetName}>{name}</h2>;
  if (!editing) {
    return (
      <h2 className={styles.sheetName}>
        <button
          type="button"
          className={styles.sheetNameBtn}
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          title="Rename"
        >
          {name}
        </button>
      </h2>
    );
  }
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) void onRename(next);
  };
  return (
    <input
      className={styles.sheetNameInput}
      aria-label="Name"
      autoFocus
      onFocus={(e) => e.target.select()}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

/** A titled card in the sheet's right column. */
export function SheetCard({
  title,
  meta,
  tone,
  children,
}: {
  title: string;
  meta?: ReactNode;
  tone?: "warning" | "ai";
  children: ReactNode;
}) {
  return (
    <section className={styles.card} data-tone={tone}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{title}</span>
        {meta !== undefined && <span className={styles.cardMeta}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** A row in a card: a dot, the words, a quieter note, and somewhere to go. */
export function CardRow({
  dot,
  text,
  note,
  under,
  onClick,
}: {
  dot?: string | null;
  text: ReactNode;
  note?: ReactNode;
  /** A quieter line under the text, for rows whose text runs long (a clue). */
  under?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {dot !== undefined && (
        <span className={styles.rowDot} style={dot ? { background: dot } : undefined} aria-hidden />
      )}
      <span className={styles.rowText}>
        {text}
        {under && <span className={styles.rowUnder}>{under}</span>}
      </span>
      {note && <span className={styles.rowNote}>{note}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={styles.cardRow} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.cardRow}>{body}</div>
  );
}

export function Badge({ children, title, tone }: { children: ReactNode; title?: string; tone?: "warning" }) {
  return (
    <span className={styles.badge} title={title} data-tone={tone}>
      {children}
    </span>
  );
}
