import { useCallback, useEffect, useState } from "react";
import { Check, CircleHelp, RotateCcw, X } from "lucide-react";
import { questionsApi } from "../../api/planning";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Question, QuestionSubject } from "../../types/planning";
import { SHORTCUTS, matchesCombo } from "../../lib/keyboard/shortcuts";
import styles from "./QuestionsList.module.css";

interface Props {
  storyId: string;
  /** Only questions about this character, place or scene; new ones are about it too. */
  subject?: QuestionSubject;
  /** Compact: no heading, for side panels and sheets. */
  compact?: boolean;
  placeholder?: string;
}

function matches(q: Question, subject?: QuestionSubject): boolean {
  if (!subject || Object.keys(subject).length === 0) return true;
  if ("node_id" in subject) return q.node_id === subject.node_id;
  if ("about_id" in subject) return q.about_type === subject.about_type && q.about_id === subject.about_id;
  return true;
}

/**
 * Open questions (refactor doc 10 P3): what the author has not decided yet. Written down
 * they stop nagging; settled, they keep their answer, so the reasoning is still there.
 */
export default function QuestionsList({ storyId, subject, compact = false, placeholder }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState("");
  const load = useCallback(() => questionsApi.list(storyId).then(setQuestions), [storyId]);
  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnUndo(["note"], load);

  const mine = questions.filter((q) => matches(q, subject));
  const open = mine.filter((q) => !q.done);
  const settled = mine.filter((q) => q.done);

  async function add() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    const created = await questionsApi.create(storyId, content, subject);
    setQuestions((qs) => [...qs, created]);
  }

  function replace(updated: Question) {
    setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
  }

  return (
    <div className={`${styles.list} ${compact ? styles.compact : ""}`}>
      {!compact && (
        <h3 className={styles.heading}>
          <CircleHelp size={14} />
          Open questions
          {open.length > 0 && <span className={styles.count}>{open.length}</span>}
        </h3>
      )}
      {open.length === 0 && !compact && (
        <p className={styles.quiet}>
          Nothing undecided written down. When you don't know something yet, put it here instead of holding it
          in your head.
        </p>
      )}
      <ul className={styles.items}>
        {open.map((q) => (
          <QuestionRow key={q.id} question={q} showSubject={!subject} onChange={replace} onRemove={load} />
        ))}
      </ul>
      <input
        className={styles.add}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
        placeholder={placeholder ?? "Add a question… (Enter)"}
        aria-label="Add a question"
      />
      {settled.length > 0 && (
        <details className={styles.settled}>
          <summary>Settled ({settled.length})</summary>
          <ul className={styles.items}>
            {settled.map((q) => (
              <li key={q.id} className={styles.settledItem}>
                <p className={styles.question}>{q.content}</p>
                {q.answer && <p className={styles.answer}>{q.answer}</p>}
                <button
                  className={styles.iconBtn}
                  title="Reopen"
                  aria-label={`Reopen “${q.content}”`}
                  onClick={async () => replace(await questionsApi.update(q.id, { done: false }))}
                >
                  <RotateCcw size={12} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  showSubject,
  onChange,
  onRemove,
}: {
  question: Question;
  showSubject: boolean;
  onChange: (q: Question) => void;
  onRemove: () => void;
}) {
  const characters = useStoryStore((s) => s.characters);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState(question.answer);
  const about =
    question.about_type === "character"
      ? characters.find((c) => c.id === question.about_id)?.name
      : (question.node_title ?? undefined);

  async function settle() {
    onChange(await questionsApi.update(question.id, { answer: answer.trim(), done: true }));
  }

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <p className={styles.question}>
          {question.content}
          {showSubject && about && <span className={styles.about}>{about}</span>}
        </p>
        <button className={styles.textBtn} onClick={() => setAnswering((a) => !a)}>
          {answering ? "Not yet" : "Answer"}
        </button>
        <button
          className={styles.iconBtn}
          title="Delete question"
          aria-label={`Delete “${question.content}”`}
          onClick={async () => {
            await questionsApi.remove(question.id);
            onRemove();
          }}
        >
          <X size={12} />
        </button>
      </div>
      {answering && (
        <div className={styles.answerForm}>
          <textarea
            autoFocus
            className={styles.answerInput}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (matchesCombo(e, SHORTCUTS.submitText.combo)) void settle();
            }}
            rows={2}
            placeholder="What you decided, and where it went…"
          />
          <button className={styles.settleBtn} onClick={settle}>
            <Check size={12} />
            Settle it
          </button>
        </div>
      )}
    </li>
  );
}
