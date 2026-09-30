import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { PanelTab } from "../../types/panel";
import { tabLabel } from "../../lib/panel/tabLabel";
import { KIND_COLOR } from "./tabColors";
import styles from "./Panel.module.css";

interface Props {
  hidden: PanelTab[];
  onPick: (id: string) => void;
  onClose: (id: string) => void;
  onDismiss: () => void;
}

/** The tabs that did not fit (doc 11): grouped so the assistant's sessions can join later. */
export default function OverflowMenu({ hidden, onPick, onClose, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div ref={ref} className={styles.menu} role="menu" aria-label="All tabs">
      <div className={styles.menuHeader}>Story</div>
      {hidden.map((tab) => (
        <div key={tab.id} className={styles.menuRow}>
          <button
            role="menuitem"
            className={styles.menuItem}
            onClick={() => onPick(tab.id)}
            style={
              {
                "--tab-color": tab.kind === "entity" ? KIND_COLOR[tab.entityKind] : undefined,
              } as React.CSSProperties
            }
          >
            <span className={`${styles.tabDot} ${tab.kind === "tool" ? styles.tabDotSquare : ""}`} />
            <span>{tabLabel(tab)}</span>
          </button>
          <button
            className={styles.tabClose}
            aria-label={`Close ${tabLabel(tab)}`}
            onClick={() => onClose(tab.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
