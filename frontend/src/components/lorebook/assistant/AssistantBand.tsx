import { useState } from "react";
import { ChevronRight, Feather, Orbit } from "lucide-react";
import FEATURES from "../../../lib/ai/featureRegistry";
import { actionFor, answerLabel, type SheetAction, type Subject } from "../../../lib/ai/sheetActions";
import { useAIAvailable } from "../../../lib/mode";
import { formatRelative } from "../../../lib/utils";
import { useAIStore } from "../../../stores/aiStore";
import { usePanelStore } from "../../../stores/panelStore";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../../llm";
import AnswerBody from "./AnswerBody";
import type { KeptAnswers } from "./useKeptAnswers";
import styles from "./Assistant.module.css";

const FOLDED_KEY = "ls_assistant_answers_folded";

function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLDED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFolded(folded: boolean) {
  try {
    localStorage.setItem(FOLDED_KEY, folded ? "1" : "0");
  } catch {
    // A convenience: without storage the band opens again next time.
  }
}

/**
 * The Assistant's kept answers, in a tone box under a sheet's header (A6, placement B): a
 * chip per answer with when it was asked, the chosen one open, and Talk it over, Ask again,
 * Clear and Fold away. In a narrow container (the side panel) the chips stack, one row per
 * answer. Folding is remembered per device. Studio only.
 */
export default function AssistantBand({
  subject,
  actions,
  kept,
  onChanged,
}: {
  subject: Subject;
  actions: SheetAction[];
  kept: KeptAnswers;
  /** Something an answer's own button changed (a clue linked to a scene). */
  onChanged?: () => void;
}) {
  const aiAvailable = useAIAvailable();
  const [folded, setFoldedState] = useState(readFolded);
  const [callId, setCallId] = useState<string | null>(null);
  const openResultSession = useAIStore((s) => s.openResultSession);
  const { answers, selected, running } = kept;

  if (!aiAvailable || (answers.length === 0 && !running)) return null;

  function setFolded(next: boolean) {
    setFoldedState(next);
    writeFolded(next);
  }

  const again = selected ? actionFor(selected.feature, actions) : undefined;
  const busyLabel = running ? (FEATURES[running]?.label ?? "The Assistant") : null;
  const busyIsNew = running && !answers.some((a) => a.feature === FEATURES[running]?.backendFeatureId);

  return (
    <div className={styles.bandWrap}>
      <section className={styles.band} aria-label="Answers from the Assistant">
        <div className={styles.bandHead}>
          <span className={styles.bandTitle}>
            <Orbit size={14} aria-hidden />
            {answers.length === 1 ? "1 answer kept" : `${answers.length} answers kept`}
          </span>
          <div className={styles.chips}>
            {answers.map((a) => {
              const on = !folded && a.id === selected?.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    kept.select(a.id);
                    setFolded(on);
                  }}
                >
                  <Orbit size={13} className={styles.rowIcon} aria-hidden />
                  <span className={styles.chipText}>
                    <span className={styles.chipName}>{answerLabel(a.feature, subject, a.heading)}</span>
                    <span className={styles.chipWhen}>
                      {" · "}
                      {running && FEATURES[running]?.backendFeatureId === a.feature
                        ? "asking again…"
                        : formatRelative(a.updated_at)}
                    </span>
                  </span>
                  <ChevronRight size={13} className={styles.rowChevron} aria-hidden />
                </button>
              );
            })}
            {busyIsNew && (
              <span className={styles.chipBusy} role="status">
                {busyLabel} · asking…
              </span>
            )}
          </div>
        </div>

        {!folded && selected && (
          <>
            <div className={styles.bandBody}>
              <AnswerBody answer={selected} subject={subject} onChanged={onChanged} />
            </div>
            <div className={styles.bandActions}>
              <button
                type="button"
                className={styles.talk}
                onClick={() => {
                  openResultSession({
                    feature: selected.feature,
                    heading: `${answerLabel(selected.feature, subject, selected.heading)}: ${subject.name}`,
                    data: selected.data,
                    context: {
                      storyId: subject.storyId,
                      characterId: subject.type === "character" ? subject.id : undefined,
                    },
                  });
                  usePanelStore.getState().openAssistant();
                }}
              >
                <Feather size={13} aria-hidden />
                Talk it over
              </button>
              {again && (
                <button
                  type="button"
                  className={styles.quiet}
                  disabled={!!running}
                  onClick={() => (again.run ? void kept.run(again) : again.open?.())}
                >
                  {running === again.id ? "Asking…" : "Ask again"}
                </button>
              )}
              <button type="button" className={styles.quiet} onClick={() => void kept.clear(selected.id)}>
                Clear
              </button>
              <span className={styles.spacer} />
              <LLMTransparencyTrigger
                onClick={() => setCallId(selected.ai_call_log_id)}
                disabled={!selected.ai_call_log_id}
              />
              <button type="button" className={styles.quiet} onClick={() => setFolded(true)}>
                Fold away
              </button>
            </div>
          </>
        )}
        <LLMTransparencyModal
          isOpen={!!callId}
          onClose={() => setCallId(null)}
          data={callId ? { callId, response: "" } : null}
        />
      </section>
    </div>
  );
}
