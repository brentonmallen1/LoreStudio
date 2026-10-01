import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eraser, ScrollText, Search, Tag } from "lucide-react";
import { api } from "../api/client";
import { jobsApi } from "../api/jobs";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import Modal from "../components/common/Modal";
import FindingRow from "../components/findings/FindingRow";
import MaintenanceView from "../components/findings/MaintenanceView";
import RunChecksMenu from "../components/findings/RunChecksMenu";
import Vitals from "../components/findings/Vitals";
import PageHeader from "../components/layout/PageHeader";
import type { MenuItem } from "../components/common/PopoverMenu";
import { groupByPlace, groupByUrgency, KIND_LABELS, type GroupBy } from "../lib/findings/group";
import { useAIAvailable } from "../lib/mode";
import { ago } from "../lib/serverDate";
import { useFindingsStore, useOpenFindings } from "../stores/findingsStore";
import { useStoryStore } from "../stores/storyStore";
import type { FindingKind } from "../types/findings";
import styles from "../components/findings/Findings.module.css";

const KINDS = Object.keys(KIND_LABELS) as FindingKind[];

/**
 * Findings (doc 12 P4, D1): one list of what needs the author's eye, from local checks,
 * the story's own records and the Assistant's runs, grouped by where it is in the story
 * or by how much it matters. Replaces the Story Health dashboard; past runs are read in
 * full in the Chronicle.
 */
export default function FindingsPage({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const by: GroupBy = params.get("by") === "urgency" ? "urgency" : "place";
  const kind = KINDS.find((k) => k === params.get("kind")) ?? null;
  const set = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const data = useFindingsStore((s) => s.data);
  const runLocal = useFindingsStore((s) => s.runLocal);
  const findings = useOpenFindings();
  const structure = useStoryStore((s) => s.structure);
  const aiAvailable = useAIAvailable();
  const shown = kind ? findings.filter((f) => f.kind === kind) : findings;
  const groups = useMemo(
    () => (by === "place" ? groupByPlace(shown, structure) : groupByUrgency(shown)),
    [by, shown, structure],
  );

  const aiRuns = Object.values(data?.last_ai_run_by_feature ?? {}).sort();
  const summary = data
    ? [
        findings.length === 1 ? "1 finding" : `${findings.length} findings`,
        `local checks ${ago(data.last_local_run)}`,
        aiAvailable && aiRuns.length ? `last Assistant run ${ago(aiRuns[aiRuns.length - 1])}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Reading the story…";

  const [tagging, setTagging] = useState(false);
  const more: MenuItem[] = [
    // Until Proposals (P5) takes these in: unattributed dialogue and unlinked names.
    { label: "Tag dialogue and mentions…", icon: Tag, onSelect: () => setTagging(true) },
    {
      label: "Scan the prose for new names",
      icon: Search,
      onSelect: () => void api.analyzeEntitySuggestions(storyId),
    },
  ];
  if (aiAvailable) {
    more.push(
      {
        label: "Refresh scene summaries",
        icon: ScrollText,
        ai: true,
        onSelect: () => void jobsApi.sceneSummaries(storyId),
      },
      {
        label: "Clear editorial notes from the prose",
        icon: Eraser,
        danger: true,
        onSelect: () => {
          if (
            window.confirm("Remove every note the editorial pass left in your scenes? Your own notes stay.")
          )
            void api.clearAllEditorialNotes(storyId);
        },
      },
    );
  }

  const counts = (k: FindingKind) => findings.filter((f) => f.kind === k).length;

  return (
    <div className={styles.page}>
      <PageHeader
        title="What needs your eye"
        summary={summary}
        views={[
          { id: "place", label: "By place" },
          { id: "urgency", label: "By urgency" },
        ]}
        view={by}
        onView={(id) => set("by", id === "place" ? null : id)}
        aside={
          <>
            <AIFeatureInfoTrigger pageId="findings" size="md" />
            <RunChecksMenu />
          </>
        }
        chips={
          <div className={styles.chips} role="group" aria-label="Show only">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={!kind}
              onClick={() => set("kind", null)}
            >
              Everything <span className={styles.chipCount}>{findings.length}</span>
            </button>
            {KINDS.filter((k) => counts(k) > 0 || k === kind).map((k) => (
              <button
                key={k}
                type="button"
                className={styles.chip}
                aria-pressed={kind === k}
                onClick={() => set("kind", kind === k ? null : k)}
              >
                {KIND_LABELS[k]} <span className={styles.chipCount}>{counts(k)}</span>
              </button>
            ))}
          </div>
        }
        more={more}
      />
      <div className={styles.scroll}>
        <div className={styles.column}>
          <Vitals storyId={storyId} />
          {data && groups.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {kind ? `Nothing about ${KIND_LABELS[kind].toLowerCase()}.` : "Nothing needs your eye."}
              </p>
              <p className={styles.emptyText}>
                {data.last_local_run
                  ? "Names, speakers, the cast and the threads are checked as you write. The rest runs when you ask."
                  : "Names, speakers, the cast and the threads are checked as you write. Prose habits, tense and point of view have not been checked yet."}
              </p>
              {!data.last_local_run && (
                <button type="button" className={styles.verb} onClick={() => void runLocal()}>
                  Check prose, tense and point of view
                </button>
              )}
            </div>
          )}
          {groups.map((g) => (
            <section key={g.id} className={styles.group} aria-label={g.label}>
              <h2 className={styles.groupTitle}>
                {g.label}
                {g.sub && <span className={styles.groupSub}>{g.sub}</span>}
              </h2>
              {g.findings.map((f) => (
                <FindingRow key={f.id} finding={f} showWhere={by === "urgency"} />
              ))}
            </section>
          ))}
          {data && (
            <p className={styles.footer}>
              {data.dismissed_count > 0 &&
                `${data.dismissed_count} dismissed: they stay out until their scene changes. `}
              Every run is kept in the <Link to={`/stories/${storyId}/chronicle`}>Chronicle</Link>.
            </p>
          )}
        </div>
      </div>
      {tagging && (
        <Modal isOpen onClose={() => setTagging(false)} title="Tag dialogue and mentions" size="lg">
          <MaintenanceView storyId={storyId} />
        </Modal>
      )}
    </div>
  );
}
