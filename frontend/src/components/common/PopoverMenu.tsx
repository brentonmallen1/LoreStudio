import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./PopoverMenu.module.css";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** An Assistant action: AI colour (callers leave it out when AI is unavailable). */
  ai?: boolean;
  danger?: boolean;
  disabled?: boolean;
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
    list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
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
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown" ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length;
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
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`${styles.item} ${item.ai ? styles.itemAi : ""} ${item.danger ? styles.itemDanger : ""}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {Icon && <Icon size={14} aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
