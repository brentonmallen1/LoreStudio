import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import { useFindingsStore } from "../../stores/findingsStore";
import type { Finding } from "../../types/findings";
import { carryBook } from "../../lib/series/promises";
import { useSeriesStore } from "../../stores/seriesStore";
import { useFindingActions } from "./useFindingActions";
import styles from "./Findings.module.css";

const SOURCE_LABEL = { local: "Local", ai: "Assistant", data: "Data" } as const;

/**
 * One finding: how much it matters (the dot), what it says, where, which kind of check
 * said it, and one verb. "It's intended" and the rest sit behind ⋯. A fix asks first,
 * in the row, saying exactly what it will change (doc 12 P4).
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
  const label = verb(f, here);

  const more: MenuItem[] = [{ label: "It's intended", icon: Check, onSelect: () => void dismiss(f.id) }];
  if (f.action === "fix" && f.anchor.node_id) {
    const shows = !!f.passages?.length;
    if (here !== "scene" || shows)
      more.push({
        label: here === "scene" ? "Show me" : shows ? "Show in the scene" : "Open the scene",
        onSelect: () => openScene(f.anchor.node_id!, f.passages),
      });
  }
  if (f.fix?.kind === "series") more.push({ label: "Compare the books", onSelect: () => openSheet(f) });
  if (aiAvailable && f.action !== "ask")
    more.push({ label: "Ask about this", ai: true, onSelect: () => void ask(f) });
  if (f.run_id && !(f.action === "ask" && !aiAvailable))
    more.push({ label: "Read the whole run", onSelect: () => readRun(f) });

  const where = [showWhere ? f.where : "", f.evidence && f.action !== "fix" ? f.evidence : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.row} data-severity={f.severity}>
      <span
        className={styles.dot}
        data-severity={f.severity}
        title={SEVERITY_TITLE[f.severity]}
        aria-hidden
      />
      <div className={styles.body}>
        <span className={styles.text}>{f.text}</span>
        {f.action === "fix" && f.evidence && <span className={styles.quote}>{f.evidence}</span>}
        {where && <span className={styles.where}>{where}</span>}
        {f.suggestion && <span className={styles.suggestion}>{f.suggestion}</span>}
        {confirming && f.fix && (
          <div className={styles.confirm} role="group" aria-label="Confirm the change">
            <span>
              {f.fix.kind === "series"
                ? `Make every book of the series say what this one says?`
                : f.fix.kind === "carry"
                  ? f.fix.story_id === useSeriesStore.getState().storyId
                    ? `Bring ${f.where} into this book, from where the books before left it?`
                    : `Bring ${f.where} into ${carryBook(f.fix.story_id)}, where this book leaves it?`
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
                  : "Change it"}
            </button>
            <button type="button" className={styles.verb} onClick={() => setConfirming(false)}>
              Not now
            </button>
          </div>
        )}
      </div>
      <span className={styles.source} data-source={f.source}>
        {SOURCE_LABEL[f.source]}
      </span>
      {label && !confirming && (
        <button
          type="button"
          className={styles.verb}
          data-ai={f.action === "ask" && aiAvailable ? true : undefined}
          onClick={() => (f.action === "fix" ? setConfirming(true) : run(f))}
        >
          {label}
        </button>
      )}
      <PopoverMenu label="More about this finding" trigger={<MoreHorizontal size={14} />} items={more} />
    </div>
  );
}

const SEVERITY_TITLE = { high: "Look at this first", mid: "Worth a look", low: "A small thing" } as const;
