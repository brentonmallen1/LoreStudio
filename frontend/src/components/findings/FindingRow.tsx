import { useId, useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import { useFindingsStore } from "../../stores/findingsStore";
import type { Finding } from "../../types/findings";
import { carryBook } from "../../lib/series/promises";
import { useSeriesStore } from "../../stores/seriesStore";
import { useFindingActions } from "./useFindingActions";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import Term from "../common/Term";
import { findingTerm } from "../../lib/findings/terms";
import SeverityMark from "./SeverityMark";
import { SOURCE_WORDS } from "../../lib/findings/words";
import styles from "./Findings.module.css";

/**
 * One finding: how much it matters (a shape, doc 30 D5), what it says, where, which kind of
 * check said it, and one verb. "Why?" opens why it can matter and what to try, with "It's on
 * purpose" and "Ask the Assistant" on the row itself; the rest sit behind ⋯. A fix asks
 * first, in the row, saying exactly what it will change (doc 12 P4).
 */
export default function FindingRow({
  finding: f,
  here,
  showWhere = true,
}: {
  finding: Finding;
  /** Inside the scene the finding is about: no "Open the scene", only "Show me". */
  here?: "scene";
  showWhere?: boolean;
}) {
  const { verb, run, ask, readRun, openScene, openSheet, aiAvailable } = useFindingActions();
  const dismiss = useFindingsStore((s) => s.dismiss);
  const fix = useFindingsStore((s) => s.fix);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const whyId = useId();
  const label = verb(f, here);
  const explained = Boolean(f.why || f.what_to_try);
  const canAsk = aiAvailable && f.action !== "ask";

  const more: MenuItem[] = [{ label: "It's on purpose", icon: Check, onSelect: () => void dismiss(f.id) }];
  if (f.action === "fix" && f.anchor.node_id) {
    const shows = !!f.passages?.length;
    if (here !== "scene" || shows)
      more.push({
        label: here === "scene" ? "Show me" : shows ? "Show in the scene" : "Open the scene",
        onSelect: () => openScene(f.anchor.node_id!, f.passages),
      });
  }
  if (f.fix?.kind === "series") more.push({ label: "Compare the books", onSelect: () => openSheet(f) });
  if (canAsk) more.push({ label: "Ask the Assistant", ai: true, onSelect: () => void ask(f) });
  if (f.run_id && !(f.action === "ask" && !aiAvailable))
    more.push({ label: "Read the whole run", onSelect: () => readRun(f) });

  const where = [showWhere ? f.where : "", f.evidence && f.action !== "fix" ? f.evidence : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.row} data-severity={f.severity} data-open={open || undefined}>
      <SeverityMark severity={f.severity} />
      <div className={styles.body}>
        <span className={styles.text}>
          <FindingText check={f.check} text={f.text} />
        </span>
        {f.action === "fix" && f.evidence && <span className={styles.quote}>{f.evidence}</span>}
        {where && <span className={styles.where}>{where}</span>}
        {f.suggestion && <span className={styles.suggestion}>{f.suggestion}</span>}
        {open && (
          <div id={whyId} className={styles.why}>
            <div className={styles.whyColumns}>
              {f.why && (
                <div className={styles.whyColumn}>
                  <span className={styles.whyLabel}>Why it can matter</span>
                  <span>{f.why}</span>
                </div>
              )}
              {f.what_to_try && (
                <div className={styles.whyColumn}>
                  <span className={styles.whyLabel}>What to try</span>
                  <span>{f.what_to_try}</span>
                </div>
              )}
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.verb} onClick={() => void dismiss(f.id)}>
                It's on purpose
              </button>
              {canAsk && (
                <button
                  type="button"
                  className={styles.verb}
                  data-ai
                  data-needs-assistant=""
                  onClick={() => void ask(f)}
                >
                  Ask the Assistant
                </button>
              )}
            </div>
          </div>
        )}
        {confirming && f.fix && (
          <div className={styles.confirm} role="group" aria-label="Confirm the change">
            <span>
              {f.fix.kind === "series"
                ? `Make every book of the series say what this one says?`
                : f.fix.kind === "carry"
                  ? f.fix.story_id === useSeriesStore.getState().storyId
                    ? `Bring ${f.where} into this book, from where the books before left it?`
                    : `Bring ${f.where} into ${carryBook(f.fix.story_id)}, where this book leaves it?`
                  : f.fix.kind === "split"
                    ? `Start a new scene at “${f.fix.old}”? Everything from it on goes with it.`
                    : f.fix.kind === "add"
                      ? `Add ${f.fix.old} to the Lorebook as a character? Their lines become theirs.`
                      : f.fix.kind === "scenes"
                        ? `Give each its own scene, named for it? ${formatCombo(SHORTCUTS.undo.combo)} takes it back.`
                        : `Change every “${f.fix.old}” in ${f.where || "this scene"} to “${f.fix.new}”?`}
            </span>
            <button
              type="button"
              className={styles.confirmYes}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await fix(f);
                } finally {
                  setBusy(false);
                  setConfirming(false);
                }
              }}
            >
              {f.fix.kind === "series"
                ? "Use it everywhere"
                : f.fix.kind === "carry"
                  ? "Bring it in"
                  : f.fix.kind === "split"
                    ? "Start the scene"
                    : f.fix.kind === "add"
                      ? "Add them"
                      : f.fix.kind === "scenes"
                        ? "Give them scenes"
                        : "Change it"}
            </button>
            <button type="button" className={styles.verb} onClick={() => setConfirming(false)}>
              Not now
            </button>
          </div>
        )}
      </div>
      <span className={styles.source} data-source={f.source}>
        {SOURCE_WORDS[f.source].label}
      </span>
      {label && !confirming && (
        <button
          type="button"
          className={styles.verb}
          data-ai={f.action === "ask" && aiAvailable ? true : undefined}
          data-needs-assistant={f.action === "ask" && aiAvailable ? "" : undefined}
          onClick={() => (f.action === "fix" ? setConfirming(true) : run(f))}
        >
          {label}
        </button>
      )}
      {explained && (
        <button
          type="button"
          className={styles.verb}
          aria-expanded={open}
          aria-controls={open ? whyId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fold away" : "Why?"}
        </button>
      )}
      <PopoverMenu label="More about this finding" trigger={<MoreHorizontal size={14} />} items={more} />
    </div>
  );
}

/** The finding's line, its craft word explained where it has one (doc 30 D1). */
function FindingText({ check, text }: { check: string; text: string }) {
  const hit = findingTerm(check, text);
  if (!hit) return <>{text}</>;
  const [before, word, after] = hit.parts;
  return (
    <>
      {before}
      <Term id={hit.id}>{word}</Term>
      {after}
    </>
  );
}
