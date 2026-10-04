import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { MICEType, PlotThread } from "../../types";
import { crossingThreads, sceneLeaves } from "../../lib/planning/methods";
import { setEndpoint } from "../../lib/threads/roles";
import styles from "./Plan.module.css";

const KINDS: { value: MICEType; label: string; hint: string }[] = [
  { value: "milieu", label: "Milieu", hint: "A place to enter and, at the end, leave" },
  { value: "idea", label: "Idea", hint: "A question to answer" },
  { value: "character", label: "Character", hint: "A change someone has to make" },
  { value: "event", label: "Event", hint: "A disruption to set right" },
];

interface Props {
  storyId: string;
  threads: PlotThread[] | null;
  reload: () => void;
}

/** MICE: the threads the story opens, each with its kind and the question it asks. */
export function ThreadsStep({ storyId, threads, reload }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MICEType>("idea");

  async function add() {
    if (!name.trim()) return;
    await api.createThread(storyId, { name: name.trim(), mice_type: kind });
    setName("");
    reload();
  }

  if (threads === null) return <p className={styles.quiet}>Loading threads…</p>;
  return (
    <div className={styles.stepBody}>
      <ul className={styles.threadList}>
        {threads.map((t) => (
          <ThreadRow key={t.id} thread={t} reload={reload} />
        ))}
      </ul>
      <form
        className={styles.threadForm}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="A thread: the missing logs, the island, Eleanor's guard…"
          aria-label="New thread name"
          autoFocus={threads.length === 0}
        />
        <select
          className={styles.input}
          value={kind}
          onChange={(e) => setKind(e.target.value as MICEType)}
          aria-label="Kind"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value} title={k.hint}>
              {k.label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.primaryBtn} disabled={!name.trim()}>
          Add thread
        </button>
      </form>
      <Link to={`/stories/${storyId}/lorebook/threads`} className={styles.quietLink}>
        Each thread's sheet: its scenes, try/fail cycles and the map of every thread
      </Link>
    </div>
  );
}

function ThreadRow({ thread, reload }: { thread: PlotThread; reload: () => void }) {
  const [name, setName] = useState(thread.name);
  const [question, setQuestion] = useState(thread.description);
  async function save(data: Parameters<typeof api.updateThread>[1]) {
    await api.updateThread(thread.id, data);
    reload();
  }
  return (
    <li className={styles.threadRow}>
      <input
        className={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== thread.name && save({ name: name.trim() })}
        aria-label="Thread name"
      />
      <select
        className={styles.input}
        value={thread.mice_type ?? ""}
        onChange={(e) => save({ mice_type: (e.target.value || null) as MICEType | null })}
        aria-label={`Kind of ${thread.name}`}
      >
        <option value="">No kind yet</option>
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        className={`${styles.input} ${styles.wide}`}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => question !== thread.description && save({ description: question })}
        placeholder={
          KINDS.find((k) => k.value === thread.mice_type)?.hint ?? "What it opens, and what closing it means"
        }
        aria-label={`What ${thread.name} opens`}
      />
    </li>
  );
}

/** MICE: the scene each thread opens in and the one it closes in, and any crossings. */
export function ThreadPlacementStep({ threads, reload }: Omit<Props, "storyId">) {
  const { structure, activeTemplate } = useStoryStore();
  const scenes = sceneLeaves(structure, activeTemplate);
  const typed = (threads ?? []).filter((t) => t.mice_type);
  const crossings = crossingThreads(typed, scenes);

  // The opening and closing scenes are roles on the thread's scenes (doc 18 C1).
  async function place(thread: PlotThread, role: "opens" | "closes", id: string) {
    await setEndpoint(thread, role, id || null);
    reload();
  }

  if (threads === null) return <p className={styles.quiet}>Loading threads…</p>;
  if (typed.length === 0)
    return <p className={styles.quiet}>Give your threads a kind in the step before this one.</p>;
  if (scenes.length === 0) return <p className={styles.quiet}>Add scenes in the scene list first.</p>;
  const sceneOptions = scenes.map((s, i) => (
    <option key={s.id} value={s.id}>
      {i + 1}. {s.title}
    </option>
  ));
  return (
    <div className={styles.stepBody}>
      {typed.map((t) => (
        <div key={t.id} className={styles.placementRow}>
          <span className={styles.threadName}>
            {t.name}
            <span className={styles.threadKind}>{KINDS.find((k) => k.value === t.mice_type)?.label}</span>
          </span>
          <select
            className={styles.input}
            value={t.opens_at_node_id ?? ""}
            onChange={(e) => place(t, "opens", e.target.value)}
            aria-label={`Where ${t.name} opens`}
          >
            <option value="">Opens in…</option>
            {sceneOptions}
          </select>
          <select
            className={styles.input}
            value={t.closes_at_node_id ?? ""}
            onChange={(e) => place(t, "closes", e.target.value)}
            aria-label={`Where ${t.name} closes`}
          >
            <option value="">Closes in…</option>
            {sceneOptions}
          </select>
        </div>
      ))}
      {crossings.map(([a, b]) => (
        <p key={`${a}-${b}`} className={styles.warning}>
          “{a}” opens before “{b}” but closes first. Threads usually close in the reverse order they opened;
          if this crossing is on purpose, carry on.
        </p>
      ))}
    </div>
  );
}
