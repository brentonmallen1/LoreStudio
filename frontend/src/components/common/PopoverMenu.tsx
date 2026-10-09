import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import styles from "./PopoverMenu.module.css";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** An Assistant action: AI colour (callers leave it out when AI is unavailable). */
  ai?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** One of a set of choices: the menu marks the current one. */
  checked?: boolean;
  /** A small mark before the label: a palette-slot dot, a status shape. */
  marker?: ReactNode;
  /** Something quiet at the row's end: a word ("POV"), a chapter's pips. */
  hint?: ReactNode;
  /** A heading drawn above the first item of each run of items in the same group. */
  group?: string;
  /** Where you are now, in a menu of places: marked, and announced as the current page. */
  current?: boolean;
  /** A quiet row after the list ("New scene"). */
  quiet?: boolean;
  /** For items whose labels can repeat (two scenes both "Untitled"). */
  key?: string;
}

/**
 * A button that opens a short menu below it. Escape or a click outside closes it and puts
 * focus back on the button; ↑↓ move between items.
 */
export default function PopoverMenu({
  label,
  trigger,
  items,
  align = "end",
  triggerClassName,
}: {
  /** The button's accessible name and tooltip ("More actions"). */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  /** A worded trigger ("Same as…") in place of the round icon button. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Start on where you are, in a menu of places or choices; else on the first item.
    const el =
      list.current?.querySelector<HTMLButtonElement>(
        'button[aria-current="page"]:not(:disabled), button[aria-checked="true"]:not(:disabled)',
      ) ?? list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    el?.focus();
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!open) return;
    const buttons = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (at + 1) % buttons.length;
    else if (e.key === "ArrowUp") next = (at - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Type a letter to jump to the next item that starts with it.
      const k = e.key.toLowerCase();
      for (let i = 1; i <= buttons.length; i++) {
        const b = buttons[(at + i) % buttons.length];
        if ((b.textContent ?? "").trim().toLowerCase().startsWith(k)) {
          next = (at + i) % buttons.length;
          break;
        }
      }
    }
    if (next < 0) return;
    e.preventDefault();
    buttons[next]?.focus();
  }

  if (items.length === 0) return null;
  return (
    <div ref={wrap} className={styles.wrap} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={triggerClassName ?? styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div ref={list} className={styles.menu} role="menu" aria-label={label} data-align={align}>
          {items.map((item, i) => {
            const Icon = item.icon;
            const heading = item.group && item.group !== items[i - 1]?.group ? item.group : null;
            const button = (
              <button
                key={item.key ?? item.label}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.checked}
                aria-current={item.current ? "page" : undefined}
                disabled={item.disabled}
                className={[
                  styles.item,
                  item.ai ? styles.itemAi : "",
                  item.danger ? styles.itemDanger : "",
                  item.current ? styles.itemCurrent : "",
                  item.quiet ? styles.itemQuiet : "",
                ].join(" ")}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.marker && (
                  <span className={styles.marker} aria-hidden>
                    {item.marker}
                  </span>
                )}
                {Icon && <Icon size={14} aria-hidden />}
                <span className={styles.label}>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
                {item.checked && <Check size={13} className={styles.check} aria-hidden />}
              </button>
            );
            if (!heading) return button;
            return (
              <Fragment key={`group:${heading}:${i}`}>
                <div className={styles.group} role="presentation">
                  {heading}
                </div>
                {button}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
