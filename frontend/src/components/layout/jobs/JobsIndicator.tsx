import { useEffect, useMemo, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { useParams } from "react-router-dom";
import { arrange, countLabel, isActive, isUnseen, titleWithCount } from "../../../lib/jobs/jobs";
import { sessionLabel } from "../../../lib/ai/sessionLabel";
import { useAIAvailable } from "../../../lib/mode";
import { navigateTo } from "../../../lib/navigation";
import { serverTime } from "../../../lib/serverDate";
import { sectionPath } from "../../../lib/routes";
import { useAIStore } from "../../../stores/aiStore";
import { jobsFirstLook, useJobsStore } from "../../../stores/jobsStore";
import { useLLMStore } from "../../../stores/llmStore";
import { usePanelStore } from "../../../stores/panelStore";
import JobRow, { JobMark } from "./JobRow";
import styles from "./Jobs.module.css";

/** A reply or a summary streaming into this window: shown with the jobs, never saved
 *  (the gateway logs the call). */
interface Live {
  id: string;
  label: string;
  line: string;
  stop: () => void;
  open?: () => void;
}

function useLive(aiAvailable: boolean): Live[] {
  const requests = useLLMStore((s) => s.requests);
  const sessions = useAIStore((s) => s.sessions);
  return useMemo(() => {
    if (!aiAvailable) return [];
    const streams: Live[] = Object.values(requests)
      .filter((r) => r.status === "streaming")
      .map((r) => ({
        id: `llm:${r.id}`,
        label: r.label,
        line: "Writing… · stops if you close this window",
        stop: () => useLLMStore.getState().cancelRequest(r.id),
      }));
    const replies: Live[] = sessions
      .filter((s) => s.isStreaming)
      .map((s) => ({
        id: `session:${s.id}`,
        label: sessionLabel(s),
        line: "Replying… · stops if you close this window",
        stop: () => useAIStore.getState().cancelStreaming(s.id),
        open: () => {
          useAIStore.getState().setActiveSession(s.id);
          usePanelStore.getState().openAssistant();
        },
      }));
    return [...streams, ...replies];
  }, [aiAvailable, requests, sessions]);
}

/**
 * Jobs (doc 21 P4): the header's sign that work is running, and the list of it. Hidden
 * while nothing runs and nothing finished unseen (D9); "Show jobs" in the palette opens
 * it any time. Its ring is the Assistant's colour while a model job or a reply runs, and
 * local work's teal otherwise. Writer mode lists local work only (D6).
 */
export default function JobsIndicator() {
  const { storyId } = useParams<{ storyId: string }>();
  const aiAvailable = useAIAvailable();
  const all = useJobsStore((s) => s.jobs);
  const open = useJobsStore((s) => s.open);
  const inTitle = useJobsStore((s) => s.inTitle);
  const away = useJobsStore((s) => s.away);
  const { setOpen, setInTitle, watch } = useJobsStore.getState();
  const live = useLive(aiAvailable);
  const [now, setNow] = useState(() => Date.now());
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => watch(), [watch]);

  const jobs = useMemo(() => (aiAvailable ? all : all.filter((j) => j.lane === "local")), [all, aiAvailable]);
  const { running, queued, finished } = arrange(jobs);
  const count = jobs.filter((j) => isActive(j) && !j.quiet).length + live.length;
  const unseen = jobs.filter(isUnseen);
  const ai = live.length > 0 || running.some((j) => j.lane !== "local");
  // Queued and nothing started: a reply going first, or the cool-down after one.
  const idle = live.length === 0 && running.every((j) => j.quiet);

  // D13: "(2) LoreStudio", only when the author asked for it.
  useEffect(() => {
    document.title = titleWithCount(document.title, inTitle ? count : 0);
  }, [count, inTitle]);

  useEffect(() => {
    if (!open) return;
    const tickTimer = setInterval(() => setNow(Date.now()), 15000);
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(tickTimer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  if (count === 0 && unseen.length === 0 && !open) return null;

  const failed = unseen.some((j) => j.status === "error");
  const label =
    count > 0 ? countLabel(count, idle) : unseen.length ? `${unseen.length} finished, not yet seen` : "Jobs";
  const close = () => setOpen(false);
  // Finished before this window opened, or while the author watched (and had the toast).
  const awayTitle = finished.some(
    (j) => away.includes(j.id) && serverTime(j.finished_at ?? j.created_at) >= jobsFirstLook() + 5000,
  )
    ? "Just finished"
    : "While you were away";
  const empty = running.length + queued.length + finished.length + live.length === 0;

  return (
    <div className={styles.wrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Jobs: ${label}`}
        title={`Jobs: ${label}`}
      >
        {count > 0 && !idle ? (
          <span className={`${styles.ring} ${ai ? styles.ringAi : styles.ringLocal}`} aria-hidden />
        ) : (
          <Activity size={15} aria-hidden />
        )}
        {count > 0 && <span className={styles.triggerText}>{countLabel(count, idle)}</span>}
        {count === 0 && unseen.length > 0 && (
          <span className={`${styles.dot} ${failed ? styles.dotFailed : ""}`} aria-hidden />
        )}
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Jobs">
          <div className={styles.head}>
            <h2 className={styles.title}>Jobs</h2>
            {storyId && (
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  close();
                  navigateTo(`${sectionPath(storyId, "chronicle", "activity")}?filter=running`);
                }}
              >
                Open the Chronicle →
              </button>
            )}
          </div>

          {empty && (
            <p className={styles.empty}>Nothing is running. What finishes in the next day is listed here.</p>
          )}

          {(running.length > 0 || live.length > 0) && (
            <section className={styles.group} aria-label="Running">
              <h3 className={styles.groupTitle}>Running</h3>
              <ul className={styles.rows}>
                {running.map((j) => (
                  <JobRow key={j.id} job={j} now={now} onLeave={close} />
                ))}
                {live.map((l) => (
                  <li key={l.id} className={styles.row}>
                    <span className={styles.mark}>
                      <JobMark status="running" ai />
                    </span>
                    <div className={styles.rowBody}>
                      {l.open ? (
                        <button
                          type="button"
                          className={styles.rowTitleBtn}
                          onClick={() => {
                            close();
                            l.open?.();
                          }}
                        >
                          {l.label}
                        </button>
                      ) : (
                        <span className={styles.rowTitle}>{l.label}</span>
                      )}
                      <span className={styles.line}>{l.line}</span>
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className={styles.action} onClick={l.stop}>
                        Stop
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {queued.length > 0 && (
            <section className={styles.group} aria-label="Queued">
              <h3 className={styles.groupTitle}>Queued</h3>
              <ul className={styles.rows}>
                {queued.map((j) => (
                  <JobRow key={j.id} job={j} now={now} onLeave={close} />
                ))}
              </ul>
            </section>
          )}

          {[
            { title: awayTitle, rows: finished.filter((j) => away.includes(j.id)) },
            {
              title: away.length ? "Earlier" : "Finished",
              rows: finished.filter((j) => !away.includes(j.id)),
            },
          ].map(
            (g) =>
              g.rows.length > 0 && (
                <section key={g.title} className={styles.group} aria-label={g.title}>
                  <h3 className={styles.groupTitle}>{g.title}</h3>
                  <ul className={styles.rows}>
                    {g.rows.map((j) => (
                      <JobRow key={j.id} job={j} now={now} onLeave={close} />
                    ))}
                  </ul>
                </section>
              ),
          )}

          <label className={styles.titlePref}>
            <input type="checkbox" checked={inTitle} onChange={(e) => setInTitle(e.target.checked)} />
            Show the count in the browser tab&rsquo;s title
          </label>
        </div>
      )}
    </div>
  );
}
