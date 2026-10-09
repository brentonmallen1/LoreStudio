import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import {
  COLOUR_MODES,
  legendFor,
  type ColourContext,
  type ColourMode,
  type Line,
} from "../../lib/strip/stripModel";
import styles from "./Strip.module.css";

interface Props {
  mode: ColourMode;
  onChange: (mode: ColourMode) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  line: Line;
  ctx: ColourContext;
  /** Expanded, the picker sits in a row and its menu drops below it; on the line, the menu
   *  opens out to the right, over the page. */
  wide?: boolean;
}

/** What the stops are coloured by: a small button showing the current mode's colours, and a menu of the modes.
 *  At the top of the strip since doc 24, so the line runs its full height. */
export default function ColourModePicker({ mode, onChange, open, setOpen, line, ctx, wide = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const swatchesOf = (m: ColourMode) => {
    const l = m === "none" ? [] : legendFor(m, line.stops, ctx).slice(0, 3);
    return l.length ? l.map((s) => s.color) : ["var(--color-text-muted)", "var(--color-surface)"];
  };
  const current = COLOUR_MODES.find((m) => m.id === mode)!;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={`${styles.modeBtn} ${wide ? styles.modeBtnWide : ""} ${open ? styles.modeBtnOn : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Colour the stops by: ${current.label}`}
        title={`Colour the stops by: ${current.label}`}
      >
        <span className={styles.modeSwatches}>
          {swatchesOf(mode).map((c, i) => (
            <span key={i} className={styles.modeSwatch} style={{ background: c }} />
          ))}
        </span>
        <span className={styles.modeLabel}>
          {current.short}
          <ChevronDown size={11} aria-hidden />
        </span>
      </button>
      {open && (
        <div
          className={`${styles.menu} ${wide ? styles.menuBelow : ""}`}
          role="menu"
          aria-label="Colour the stops by"
        >
          <div className={styles.menuHeader}>Colour the stops by</div>
          {COLOUR_MODES.map((m) => (
            <button
              key={m.id}
              role="menuitemradio"
              aria-checked={m.id === mode}
              className={`${styles.menuItem} ${m.id === mode ? styles.menuItemOn : ""}`}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
            >
              <span className={`${styles.radio} ${m.id === mode ? styles.radioOn : ""}`} />
              <span className={styles.menuText}>
                <span className={styles.menuLabel}>{m.label}</span>
                <span className={styles.menuSub}>{m.sub}</span>
              </span>
              <span className={styles.modeSwatches}>
                {swatchesOf(m.id).map((c, i) => (
                  <span key={i} className={styles.modeSwatch} style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
