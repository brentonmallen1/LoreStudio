import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Play } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { ago } from "../../lib/serverDate";
import { useFindingsStore } from "../../stores/findingsStore";
import { useStoryStore } from "../../stores/storyStore";
import { ASSISTANT_CHECKS } from "./checks";
import EditorialPassDialog from "./EditorialPassDialog";
import styles from "./Findings.module.css";

/**
 * "Run checks" (doc 12 P4): the local checks, which are instant and mostly always current,
 * and, where the Assistant is available, its checks, each with when it last ran. A run
 * keeps going if the menu closes; the list refreshes when it lands.
 */
export default function RunChecksMenu() {
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const aiAvailable = useAIAvailable();
  const data = useFindingsStore((s) => s.data);
  const runningLocal = useFindingsStore((s) => s.runningLocal);
  const runLocal = useFindingsStore((s) => s.runLocal);
  const refetch = useFindingsStore((s) => s.refetch);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<Record<string, AbortController>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [editorial, setEditorial] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes it wherever focus went: a run disables its item, and focus falls to the page.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
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

  async function runCheck(id: string, run: (storyId: string, signal: AbortSignal) => Promise<unknown>) {
    if (!storyId) return;
    const controller = new AbortController();
    setRunning((r) => ({ ...r, [id]: controller }));
    setFailed(({ [id]: _gone, ...rest }) => rest);
    try {
      await run(storyId, controller.signal);
      await refetch();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setFailed((f) => ({ ...f, [id]: e instanceof Error ? e.message : "It did not finish" }));
    } finally {
      setRunning(({ [id]: _done, ...rest }) => rest);
    }
  }

  const busy = runningLocal || Object.keys(running).length > 0;
  const sizing = data?.sizing;
  const notes = [
    sizing && !sizing.has_chapters ? "No chapters, so no chapter checks." : "",
    sizing && !sizing.has_target ? "No target length, so no length check." : "",
    "Every run is kept in the Chronicle.",
  ].filter(Boolean);

  return (
    <div className={styles.runWrap} ref={wrap} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={styles.runButton}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? <Loader2 size={14} className={styles.spin} aria-hidden /> : <Play size={13} aria-hidden />}
        {busy ? "Checking…" : "Run checks"}
        <ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div className={styles.runMenu} role="menu" ref={list}>
          <div className={styles.runHeading}>Local · no model, nothing leaves your machine</div>
          <div className={styles.runItem} data-static>
            <span className={styles.runDot} data-source="local" />
            <span className={styles.runLabel}>Names, speakers, cast, threads, chapters</span>
            <span className={styles.runWhen}>always current</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className={styles.runItem}
            disabled={runningLocal}
            onClick={() => void runLocal()}
          >
            <span className={styles.runDot} data-source="local" />
            <span className={styles.runLabel}>Prose habits, tense, point of view</span>
            <span className={styles.runWhen}>{runningLocal ? "running…" : ago(data?.last_local_run)}</span>
          </button>
          {aiAvailable && (
            <>
              <div className={styles.runHeading} data-ai>
                Assistant · only when you ask
              </div>
              {ASSISTANT_CHECKS.map((c) => {
                const active = running[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    className={styles.runItem}
                    title={failed[c.id] ?? c.hint}
                    onClick={() => (active ? active.abort() : void runCheck(c.id, c.run))}
                  >
                    <span className={styles.runDot} data-source="ai" />
                    <span className={styles.runLabel}>{c.label}</span>
                    <span className={styles.runWhen} data-failed={failed[c.id] ? true : undefined}>
                      {active
                        ? "running… click to stop"
                        : failed[c.id]
                          ? "did not finish"
                          : ago(data?.last_ai_run_by_feature[c.id])}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                className={styles.runItem}
                onClick={() => {
                  setOpen(false);
                  setEditorial(true);
                }}
              >
                <span className={styles.runDot} data-source="ai" />
                <span className={styles.runLabel}>Editorial pass…</span>
                <span className={styles.runWhen}>{ago(data?.last_ai_run_by_feature["editorial-pass"])}</span>
              </button>
            </>
          )}
          <div className={styles.runNote}>{notes.join(" ")}</div>
        </div>
      )}
      {editorial && <EditorialPassDialog onClose={() => setEditorial(false)} onDone={() => void refetch()} />}
    </div>
  );
}
