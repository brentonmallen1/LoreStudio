import { useState } from "react";
import { ChevronDown, ChevronUp, Compass, Feather } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import styles from "./Lorebook.module.css";

export interface AssistantAction {
  label: string;
  /** What it does, for the tooltip. */
  title: string;
  /** Opens a conversation (Feather) rather than running an analysis (Compass). */
  chat?: boolean;
  onRun: () => void;
}

/**
 * The Assistant's actions for a sheet or a Plan step, folded into one row (doc 12: purple on
 * results, not spread across headers). Absent in Writer mode and with AI switched off.
 */
export default function AssistantRow({ actions }: { actions: AssistantAction[] }) {
  const aiAvailable = useAIAvailable();
  const [open, setOpen] = useState(false);
  if (!aiAvailable || actions.length === 0) return null;
  if (actions.length === 1) {
    // One action needs no unfolding: the row is the button (a Plan step's guidance, doc 14 Q2).
    const [a] = actions;
    return (
      <section className={styles.assistantRow}>
        <button type="button" className={styles.assistantToggle} title={a.title} onClick={a.onRun}>
          {a.chat ? <Feather size={13} aria-hidden /> : <Compass size={13} aria-hidden />}
          <span className={styles.assistantTitle}>Assistant</span>
          <span className={styles.assistantHint}>{a.label}</span>
        </button>
      </section>
    );
  }
  return (
    <section className={styles.assistantRow} data-open={open || undefined}>
      <button
        type="button"
        className={styles.assistantToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Feather size={13} aria-hidden />
        <span className={styles.assistantTitle}>Assistant</span>
        <span className={styles.assistantHint}>{actions.map((a) => a.label).join(" · ")}</span>
        {open ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
      </button>
      {open && (
        <div className={styles.assistantActions}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={styles.assistantBtn}
              title={a.title}
              onClick={a.onRun}
            >
              {a.chat ? <Feather size={12} aria-hidden /> : <Compass size={12} aria-hidden />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
