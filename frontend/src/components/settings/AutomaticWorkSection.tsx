import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/request";
import {
  AUTOMATIC_JOB_KINDS,
  automaticApi,
  type AutomaticOption,
  type AutomaticPatch,
  type AutomaticTask,
  type AutomaticWork,
} from "../../api/automatic";
import { useOnJobFinished } from "../../hooks/useJobs";
import { parseServerDate, serverTime } from "../../lib/serverDate";
import { toast } from "../../stores/toastStore";
import { SETTINGS_SECTIONS } from "../../pages/settings/sections";
import s from "../../pages/Settings.module.css";
import styles from "./AutomaticWork.module.css";

/** "9:22 AM" today, "Mon 9:22 AM" this week, then the date. */
function when(iso: string): string {
  const at = parseServerDate(iso);
  const days = (Date.now() - at.getTime()) / 86_400_000;
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (at.toDateString() === new Date().toDateString()) return time;
  if (days < 6) return `${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "in 3 h", "in 40 min", "due now". */
function dueIn(iso: string): string {
  const min = Math.round((serverTime(iso) - Date.now()) / 60_000);
  if (min <= 0) return "due now";
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className={s.toggle}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={s.toggleTrack} />
    </label>
  );
}

/** A number saved when it is left or Enter is pressed, and only if it is in bounds. */
function NumberField({
  task,
  option,
  disabled,
  save,
}: {
  task: AutomaticTask;
  option: AutomaticOption;
  disabled: boolean;
  save: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(option.value));
  const commit = () => {
    const n = Number(draft);
    if (draft === String(option.value)) return;
    if (!Number.isInteger(n) || n < option.min || n > option.max) {
      toast.error(`${option.label} must be ${option.min} to ${option.max.toLocaleString()}.`);
      setDraft(String(option.value));
      return;
    }
    save(n);
  };
  return (
    <span className={styles.number}>
      <input
        className={styles.numberInput}
        type="number"
        inputMode="numeric"
        min={option.min}
        max={option.max}
        aria-label={`${task.label}: ${option.label} (${option.unit})`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className={styles.unit}>{option.unit}</span>
    </span>
  );
}

function TaskCard({
  task,
  paused,
  canEdit,
  change,
  runNow,
}: {
  task: AutomaticTask;
  paused: boolean;
  canEdit: boolean;
  change: (patch: Record<string, number | boolean>) => void;
  runNow: () => void;
}) {
  const live = task.enabled && !paused;
  const link = task.link ? SETTINGS_SECTIONS.find((sec) => sec.id === task.link) : undefined;
  return (
    <div className={`${s.card} ${live ? "" : styles.off}`}>
      <div className={styles.head}>
        <h3 className={styles.title}>{task.label}</h3>
        <Switch
          label={`${task.label}: on`}
          checked={task.enabled}
          disabled={!canEdit}
          onChange={(on) => change({ enabled: on })}
        />
      </div>
      <p className={styles.description}>{task.description}</p>
      <p className={styles.cadence}>
        {live ? task.cadence : paused ? "Paused, with everything else" : "Off"}
        {live && task.next_at && <span className={styles.muted}> · next {dueIn(task.next_at)}</span>}
      </p>
      {task.options.length > 0 && (
        <div className={s.backupForm}>
          {task.options.map((o) => (
            <div key={o.key} className={s.fieldRow}>
              <span className={s.label}>{o.label}</span>
              {o.kind === "switch" ? (
                <Switch
                  label={`${task.label}: ${o.label}`}
                  checked={Boolean(o.value)}
                  disabled={!canEdit || !task.enabled}
                  onChange={(on) => change({ [o.key]: on })}
                />
              ) : (
                <NumberField
                  key={String(o.value)}
                  task={task}
                  option={o}
                  disabled={!canEdit || !task.enabled}
                  save={(n) => change({ [o.key]: n })}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className={styles.foot}>
        <span className={task.last_run && !task.last_run.ok ? styles.failed : styles.muted}>
          {task.last_run ? `Last ran ${when(task.last_run.at)}: ${task.last_run.summary}` : "Has not run yet"}
        </span>
        <span className={styles.actions}>
          {link && (
            <a className={styles.link} href={`#${link.id}`}>
              {link.label} settings
            </a>
          )}
          {task.can_run_now && canEdit && (
            <button type="button" className={styles.runBtn} onClick={runNow}>
              Run now
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Settings › Automatic work (doc 22): everything LoreStudio does by itself, what each does, when
 * it runs, when it last ran and what it did, with a switch for each and one for all. The list
 * and its wording come from the server (services/automatic.py), so the page cannot describe a
 * schedule the code does not keep. Admins change it; anyone else reads it.
 */
export default function AutomaticWorkSection() {
  const [work, setWork] = useState<AutomaticWork | null>(null);

  const load = useCallback(() => {
    automaticApi
      .get()
      .then(setWork)
      .catch(() => setWork(null));
  }, []);
  useEffect(load, [load]);
  // A run finishing changes its "last ran".
  useOnJobFinished(AUTOMATIC_JOB_KINDS, load);

  const update = (patch: AutomaticPatch) =>
    automaticApi
      .update(patch)
      .then(setWork)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "The change could not be saved."));

  const runNow = (task: AutomaticTask) =>
    automaticApi
      .runNow(task.id)
      .then(() => toast.info(`${task.label}: running now. Jobs in the header shows it.`))
      .catch(() => toast.error(`${task.label} could not be started.`));

  return (
    <section className={s.section} id="automatic">
      <h2 className={s.sectionLabel}>Automatic work</h2>
      <div className={s.card}>
        <p className={s.sectionHint}>
          What LoreStudio does by itself, and when. While one of these runs it shows in Jobs in the header,
          like anything you start; when it finishes it says nothing. Pausing stops them all; your own buttons,
          like Back up now and Measure now, still work.
        </p>
        {work && (
          <label className={s.toggleRow}>
            <div className={s.toggleLabel}>
              <span className={s.label}>
                {work.paused ? "Automatic work is paused" : "Automatic work is on"}
              </span>
            </div>
            <Switch
              label="Automatic work: on"
              checked={!work.paused}
              disabled={!work.can_edit}
              onChange={(on) => void update({ paused: !on })}
            />
          </label>
        )}
        {work && !work.can_edit && <p className={s.hint}>Only an admin can change these.</p>}
      </div>
      {work?.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          paused={work.paused}
          canEdit={work.can_edit}
          change={(patch) => void update({ tasks: { [task.id]: patch } })}
          runNow={() => void runNow(task)}
        />
      ))}
    </section>
  );
}
