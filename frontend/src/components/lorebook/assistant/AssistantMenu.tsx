import { useEffect, useRef, useState } from "react";
import { ChevronDown, Feather, Orbit } from "lucide-react";
import FEATURES from "../../../lib/ai/featureRegistry";
import { backendFeature, type SheetAction } from "../../../lib/ai/sheetActions";
import { useAIAvailable } from "../../../lib/mode";
import { formatRelative } from "../../../lib/utils";
import type { KeptAnswers } from "./useKeptAnswers";
import styles from "./Assistant.module.css";

/**
 * "Assistant ▾" in a sheet's header (A6): what the Assistant can do for this thing, each with
 * its one line from the registry, and whether its answer is already kept below. Studio only;
 * in Writer mode, or with AI off, there is no trace of it.
 */
export default function AssistantMenu({
  name,
  actions,
  kept,
  compact = false,
}: {
  name: string;
  actions: SheetAction[];
  kept: KeptAnswers;
  /** The side panel's smaller button. */
  compact?: boolean;
}) {
  const aiAvailable = useAIAvailable();
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

  if (!aiAvailable || actions.length === 0) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const items = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div ref={wrap} className={styles.menuWrap} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={`${styles.trigger} ${compact ? styles.triggerCompact : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Orbit size={compact ? 13 : 14} aria-hidden />
        Assistant
        <ChevronDown size={compact ? 12 : 13} aria-hidden />
      </button>
      {open && (
        <div ref={list} role="menu" aria-label={`Ask the Assistant about ${name}`} className={styles.menu}>
          <div className={styles.menuHead}>Ask the Assistant about {name}</div>
          {actions.map((a) => {
            const info = FEATURES[a.id];
            const answer = kept.answers.find((r) => r.feature === backendFeature(a.id));
            const Icon = a.chat ? Feather : Orbit;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={!!a.run && kept.running === a.id}
                onClick={() => {
                  setOpen(false);
                  if (a.run) void kept.run(a);
                  else a.open?.();
                }}
              >
                <Icon size={15} className={styles.menuIcon} aria-hidden />
                <span className={styles.menuText}>
                  <span className={styles.menuLabel}>{info?.label ?? a.id}</span>
                  {info?.shortDescription && <span className={styles.menuDesc}>{info.shortDescription}</span>}
                  {kept.running === a.id ? (
                    <span className={styles.menuKept}>Asking now…</span>
                  ) : (
                    answer && (
                      <span className={styles.menuKept}>
                        Answer kept below · {formatRelative(answer.updated_at)}
                      </span>
                    )
                  )}
                </span>
              </button>
            );
          })}
          <div className={styles.menuFoot}>
            Answers stay on this page until you clear them or ask again. Nothing changes your story without
            you.
          </div>
        </div>
      )}
    </div>
  );
}
