import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Progress } from "../../lib/firstStory/progress";
import type { Step } from "../../lib/firstStory/steps";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { sceneLeaves } from "../../lib/planning/methods";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { THREAD_KINDS } from "../../lib/threads/kinds";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { MICEType } from "../../types";
import styles from "./FirstStory.module.css";

interface Props {
  step: Step;
  storyId: string;
  progress: Progress;
  onBack?: () => void;
  onSkip?: () => void;
  /** Saved: what the step made, for coming back to it. */
  onDone: (made?: Partial<Progress>) => void;
  nextTitle?: string;
}

/** One step's fields and its Back / Next / Skip. Saving makes real story data. */
export default function StepBody(props: Props) {
  switch (props.step.id) {
    case "idea":
      return <Idea {...props} />;
    case "who":
      return <Who {...props} />;
    case "question":
      return <Question {...props} />;
    case "secret":
      return <Secret {...props} />;
    case "scenes":
      return <Scenes {...props} />;
    case "write":
      return <Write {...props} />;
    default:
      return <Tour {...props} />;
  }
}

function Nav({
  onBack,
  onSkip,
  onNext,
  nextTitle,
  ready = true,
}: Pick<Props, "onBack" | "onSkip" | "nextTitle"> & { onNext: () => Promise<void> | void; ready?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function next() {
    setBusy(true);
    try {
      await onNext();
    } catch {
      toast.error("That could not be saved. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.nav}>
      {onBack && (
        <button type="button" className={styles.secondary} onClick={onBack}>
          Back
        </button>
      )}
      <button type="button" className={styles.primary} disabled={busy || !ready} onClick={() => void next()}>
        {nextTitle ? `Next: ${nextTitle.charAt(0).toLowerCase()}${nextTitle.slice(1)}` : "Done"}
      </button>
      {onSkip && (
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip for now
        </button>
      )}
    </div>
  );
}

function Idea({ storyId, onDone, ...nav }: Props) {
  const story = useStoryStore((s) => s.activeStory);
  const upsertStory = useStoryStore((s) => s.upsertStory);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);
  const [text, setText] = useState(story?.logline ?? "");
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>Your story in a sentence</span>
        <textarea
          rows={3}
          value={text}
          placeholder="When…, someone must… or else…"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Nav
        {...nav}
        ready={!!text.trim()}
        onNext={async () => {
          const saved = await api.updateStory(storyId, { logline: text.trim() });
          upsertStory(saved);
          setActiveStory(saved);
          onDone();
        }}
      />
    </>
  );
}

function Who({ storyId, progress, onDone, ...nav }: Props) {
  const existing = useStoryStore((s) => s.characters.find((c) => c.id === progress.characterId));
  const upsertCharacter = useStoryStore((s) => s.upsertCharacter);
  const [name, setName] = useState(existing?.name ?? "");
  const [want, setWant] = useState(existing?.motivation ?? "");
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>Their name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Who is it about?" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>What they want</span>
        <textarea
          rows={2}
          value={want}
          onChange={(e) => setWant(e.target.value)}
          placeholder="More than anything, they want…"
        />
      </label>
      <Nav
        {...nav}
        ready={!!name.trim()}
        onNext={async () => {
          const data = { name: name.trim(), motivation: want.trim() };
          const saved = existing
            ? await api.updateCharacter(existing.id, data)
            : await api.createCharacter(storyId, { ...data, role: "protagonist" });
          upsertCharacter(saved);
          onDone({ characterId: saved.id });
        }}
      />
    </>
  );
}

const OTHER_KINDS: { value: MICEType; label: string }[] = [
  { value: "character", label: "a change in someone" },
  { value: "milieu", label: "a place to explore" },
  { value: "event", label: "a world knocked out of order" },
];

/** A thread's name from its question: its first few words. */
const nameFrom = (text: string) => {
  const words = text
    .trim()
    .replace(/[?.!]+$/, "")
    .split(/\s+/);
  return words.length <= 6 ? words.join(" ") : `${words.slice(0, 6).join(" ")}…`;
};

function Question({ storyId, progress, onDone, ...nav }: Props) {
  const existing = useStoryStore((s) => s.threads.find((t) => t.id === progress.threadId));
  const [text, setText] = useState(existing?.description ?? "");
  const [kind, setKind] = useState<MICEType>((existing?.mice_type as MICEType) ?? "idea");
  const label = THREAD_KINDS.find((k) => k.value === kind)?.label ?? "A question";
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>
          {kind === "idea" ? "Your story's question" : `Your story's promise: ${label.toLowerCase()}`}
        </span>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === "idea"
              ? "What does the reader want to find out?"
              : THREAD_KINDS.find((k) => k.value === kind)?.hint
          }
        />
      </label>
      <div className={styles.chips}>
        <span className={styles.chipsLabel}>
          {kind === "idea" ? "Not a question? It might be" : "Or it might be"}
        </span>
        {[{ value: "idea" as MICEType, label: "a question" }, ...OTHER_KINDS]
          .filter((k) => k.value !== kind)
          .map((k) => (
            <button key={k.value} type="button" className={styles.chip} onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
      </div>
      <Nav
        {...nav}
        ready={!!text.trim()}
        onNext={async () => {
          const data = { name: nameFrom(text), description: text.trim(), mice_type: kind };
          const saved = existing
            ? await api.updateThread(existing.id, data)
            : await api.createThread(storyId, data);
          await refreshThreads(storyId);
          onDone({ threadId: saved.id });
        }}
      />
    </>
  );
}

function Secret({ storyId, progress, onDone, ...nav }: Props) {
  const [truth, setTruth] = useState("");
  const [belief, setBelief] = useState("");
  // Twists are not in the story store: coming back, fetch what was written.
  useEffect(() => {
    if (!progress.twistId) return;
    api.getTwist(progress.twistId).then(
      (t) => {
        setTruth(t.the_truth);
        setBelief(t.the_misdirection);
      },
      () => {},
    );
  }, [progress.twistId]);
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>The truth</span>
        <textarea
          rows={2}
          value={truth}
          onChange={(e) => setTruth(e.target.value)}
          placeholder="What is really going on?"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>What the reader believes until then</span>
        <textarea
          rows={2}
          value={belief}
          onChange={(e) => setBelief(e.target.value)}
          placeholder="What do they think is going on?"
        />
      </label>
      <Nav
        {...nav}
        ready={!!truth.trim()}
        onNext={async () => {
          const data = { the_truth: truth.trim(), the_misdirection: belief.trim() };
          const saved = progress.twistId
            ? await api.updateTwist(progress.twistId, data)
            : await api.createTwist(storyId, { name: nameFrom(truth), ...data });
          onDone({ twistId: saved.id });
        }}
      />
    </>
  );
}

const PARTS = ["The start", "The middle", "The end"];

function Scenes({ storyId, progress, onDone, ...nav }: Props) {
  const { structure, activeTemplate } = useStoryStore();
  const leaves = sceneLeaves(structure, activeTemplate);
  const mine = (progress.sceneIds ?? []).map((id) => leaves.find((n) => n.id === id));
  const [rows, setRows] = useState(
    PARTS.map((_, i) => ({ title: mine[i]?.title ?? "", line: mine[i]?.synopsis ?? "" })),
  );
  const set = (i: number, patch: Partial<{ title: string; line: string }>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { title, line } = rows[i];
      const known = mine[i];
      // The outline's empty first scene becomes the start, rather than sitting before it.
      const reuse =
        !known && i === 0 && !progress.sceneIds && leaves.length === 1 && !leaves[0].word_count
          ? leaves[0]
          : undefined;
      const node = known ?? reuse;
      if (node) {
        await api.updateNode(node.id, { title: title.trim() || node.title, synopsis: line.trim() });
        ids.push(node.id);
      } else {
        const made = await addPlannedScene(storyId, {
          title: title.trim() || PARTS[i],
          synopsis: line.trim(),
        });
        if ("hint" in made) throw new Error(made.hint);
        ids.push(made.node.id);
      }
    }
    useStoryStore.getState().setStructure(await api.getStructure(storyId));
    // The story's question opens in the first scene and is answered in the last.
    if (progress.threadId) {
      await api.addThreadAppearance(progress.threadId, ids[0], { role: "opens" });
      await api.addThreadAppearance(progress.threadId, ids[2], { role: "closes" });
      await refreshThreads(storyId);
    }
    if (progress.twistId) await api.updateTwist(progress.twistId, { revealed_at_node_id: ids[2] });
    onDone({ sceneIds: ids });
  }

  return (
    <>
      {PARTS.map((part, i) => (
        <div key={part} className={styles.sceneRow}>
          <span className={styles.label}>{part}</span>
          <input
            aria-label={`${part}: its title`}
            value={rows[i].title}
            placeholder="A title"
            onChange={(e) => set(i, { title: e.target.value })}
          />
          <input
            aria-label={`${part}: what happens`}
            value={rows[i].line}
            placeholder="What happens, in a line"
            onChange={(e) => set(i, { line: e.target.value })}
          />
        </div>
      ))}
      <Nav {...nav} ready={rows.some((r) => r.title.trim() || r.line.trim())} onNext={save} />
    </>
  );
}

function Write({ storyId, progress, onDone, ...nav }: Props) {
  const navigate = useNavigate();
  const { structure, activeTemplate } = useStoryStore();
  const first = progress.sceneIds?.[0] ?? sceneLeaves(structure, activeTemplate)[0]?.id;
  return (
    <>
      <div className={styles.nav}>
        {first ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              onDone();
              navigate(`/stories/${storyId}/write/${first}`);
            }}
          >
            Open the first scene
          </button>
        ) : (
          <p className={styles.explain}>Add a scene in the step before this one, then come back.</p>
        )}
      </div>
      {/* Moving on without opening the scene is not writing it: the step stays unticked. */}
      <Nav onBack={nav.onBack} nextTitle={nav.nextTitle} onNext={() => nav.onSkip?.()} />
    </>
  );
}

function Tour({ storyId, progress, onBack }: Props) {
  const story = useStoryStore((s) => s.activeStory);
  const places: { done: boolean; what: string; where: string; to: string }[] = [
    {
      done: !!story?.logline,
      what: "Your logline",
      where: "Lorebook › Story Identity",
      to: sectionPath(storyId, "lorebook", "identity"),
    },
    {
      done: !!progress.characterId,
      what: "Your first character",
      where: "Lorebook › Characters",
      to: sectionPath(storyId, "lorebook", "characters", progress.characterId),
    },
    {
      done: !!progress.threadId,
      what: "Your story's question, a thread",
      where: "Promises › Threads, and on the tapestry",
      to: sectionPath(storyId, "promises", "threads", progress.threadId),
    },
    {
      done: !!progress.twistId,
      what: "Your secret, a twist",
      where: "Promises › Twists",
      to: sectionPath(storyId, "promises", "twists", progress.twistId),
    },
    {
      done: !!progress.sceneIds?.length,
      what: "Your scenes",
      where: "The strip down the left, and the Plan page",
      to: `/stories/${storyId}/plan`,
    },
  ];
  return (
    <>
      <ul className={styles.tour}>
        {places.map((p) => (
          <li key={p.what} className={p.done ? "" : styles.tourLater}>
            <Link to={p.to}>{p.what}</Link>
            <span>{p.done ? p.where : `${p.where}, when you get to it`}</span>
          </li>
        ))}
        <li>
          <Link to="/guides/promises">Threads, twists and what the reader knows</Link>
          <span>A guide to the promises your story makes</span>
        </li>
      </ul>
      <div className={styles.nav}>
        {onBack && (
          <button type="button" className={styles.secondary} onClick={onBack}>
            Back
          </button>
        )}
        <Link to={`/stories/${storyId}`} className={styles.primary}>
          Go to your story
        </Link>
      </div>
    </>
  );
}
