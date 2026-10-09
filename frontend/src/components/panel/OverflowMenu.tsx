import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { PanelTab } from "../../types/panel";
import { useAIAvailable } from "../../lib/mode";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { sessionLabel } from "../../lib/ai/sessionLabel";
import { tabLabel } from "../../lib/panel/tabLabel";
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
  const aiAvailable = useAIAvailable();
  const sessions = useAIStore((s) => s.sessions);
  const setActiveSession = useAIStore((s) => s.setActiveSession);
  const closeSession = useAIStore((s) => s.closeSession);
  const openAssistant = usePanelStore((s) => s.openAssistant);
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
      {hidden.length > 0 && <div className={styles.menuHeader}>Story</div>}
      {hidden.map((tab) => (
        <div key={tab.id} className={styles.menuRow}>
          <button role="menuitem" className={styles.menuItem} onClick={() => onPick(tab.id)}>
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
      {aiAvailable && sessions.length > 0 && (
        <>
          <div className={styles.menuHeader}>Assistant</div>
          {sessions.map((session) => (
            <div key={session.id} className={styles.menuRow}>
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ color: "var(--color-ai)" }}
                onClick={() => {
                  setActiveSession(session.id);
                  openAssistant();
                  onDismiss();
                }}
              >
                <span
                  className={styles.tabDot}
                  style={{ background: "var(--color-ai)", borderRadius: 2, transform: "rotate(45deg)" }}
                />
                <span>{sessionLabel(session)}</span>
              </button>
              <button
                className={styles.tabClose}
                aria-label={`Close ${sessionLabel(session)}`}
                onClick={() => closeSession(session.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
