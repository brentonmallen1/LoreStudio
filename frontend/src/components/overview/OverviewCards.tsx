import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { slotVar } from "../../lib/colorSlots";
import { bySeverity } from "../../lib/findings/group";
import { findRoute, sectionPath, storyPath } from "../../lib/routes";
import { ago } from "../../lib/serverDate";
import { useOpenFindings } from "../../stores/findingsStore";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryOverview } from "../../types";
import { useFindingActions } from "../findings/useFindingActions";
import styles from "./Overview.module.css";

/**
 * The Overview's cards (doc 12 P6): the story's numbers, what needs the author's eye,
 * where the words are, who and where it is about, and what happened lately. Every number
 * and name links to where it is changed.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function Vitals({ storyId, ov }: { storyId: string; ov: StoryOverview }) {
  const target = ov.word_count_target;
  const states = (["draft", "revised", "final", "planned"] as const)
    .filter((s) => ov.scenes_by_status[s])
    .map((s) => `${ov.scenes_by_status[s]} ${s}`)
    .join(" · ");
  const items = [
    {
      label: "Words",
      value: ov.word_count.toLocaleString(),
      sub: target ? `${Math.round(target.pct)}% of ${target.max.toLocaleString()}` : "no target length set",
      bar: target ? Math.min(100, target.pct) : null,
      warn: target?.warning_level,
      // The figures open the page that measures them (doc 13 P3).
      to: `/stories/${storyId}/numbers`,
    },
    {
      label: "Scenes",
      value: String(ov.scene_count),
      sub: states || "none yet",
      to: `/stories/${storyId}/numbers`,
    },
    {
      label: "Threads",
      value: `${ov.open_threads.length} open`,
      sub:
        ov.open_threads.join(" · ") ||
        (ov.thread_counts.resolved ? `${ov.thread_counts.resolved} resolved, none open` : "none open"),
      to: sectionPath(storyId, "lorebook", "threads"),
    },
    {
      label: "Goals",
      value: ov.goals_total ? `${ov.goals_done} of ${ov.goals_total}` : "None set",
      sub: ov.next_goal ? `Next: ${ov.next_goal}` : ov.goals_total ? "all met" : "what this draft is for",
      to: sectionPath(storyId, "lorebook", "identity"),
    },
  ];
  return (
    <nav className={styles.vitals} aria-label="The story in numbers">
      {items.map((v) => (
        <Link key={v.label} to={v.to} className={styles.vital}>
          <span className={styles.label}>{v.label}</span>
          <ChevronRight size={14} className={styles.vitalGo} aria-hidden />
          <span className={styles.vitalValue}>{v.value}</span>
          <span className={styles.vitalSub}>{v.sub}</span>
          {"bar" in v && v.bar !== null && v.bar !== undefined && (
            <span className={styles.vitalBar} data-warn={v.warn !== "normal" ? v.warn : undefined}>
              <span style={{ width: `${v.bar}%` }} />
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function NeedsYourEye({ storyId }: { storyId: string }) {
  const findings = useOpenFindings();
  const { run } = useFindingActions();
  const route = findRoute("findings");
  const top = [...findings].sort(bySeverity).slice(0, 3);
  return (
    <section className={styles.card} aria-label="Needs your eye">
      <div className={styles.cardHead}>
        <h2 className={styles.label} data-tone="warning">
          Needs your eye
        </h2>
        {route && findings.length > 0 && (
          <Link to={storyPath(storyId, route)} className={styles.headLink}>
            {findings.length === 1 ? "The finding →" : `All ${findings.length} findings →`}
          </Link>
        )}
      </div>
      {top.length === 0 ? (
        <p className={styles.quiet}>Nothing right now. Checks run as you write.</p>
      ) : (
        top.map((f) => (
          <button key={f.id} type="button" className={styles.rowLink} onClick={() => run(f)}>
            <span className={styles.dot} data-severity={f.severity} aria-hidden />
            <span className={styles.rowText}>{f.text}</span>
            <span className={styles.rowMeta} data-ai={f.source === "ai" || undefined}>
              {f.where || (f.source === "ai" ? "Assistant" : "")}
            </span>
            <ChevronRight size={14} className={styles.rowGo} aria-hidden />
          </button>
        ))
      )}
    </section>
  );
}

export function WordsByChapter({ storyId, ov }: { storyId: string; ov: StoryOverview }) {
  const activeNode = useStoryStore((s) => s.activeNode);
  // The caption names the bar under the pointer, or the one you are in (doc 14 Overview):
  // the values were only in tooltips, which a keyboard or a touch never shows.
  const [pointed, setPointed] = useState<string | null>(null);
  const max = Math.max(1, ...ov.distribution.map((d) => d.word_count));
  const kind = ov.distribution[0]?.level_type || "section";
  if (ov.distribution.length < 2) return null;
  const isHere = (id: string) => id === activeNode?.id || id === activeNode?.parent_id;
  const shown = ov.distribution.find((d) => d.id === pointed) ?? ov.distribution.find((d) => isHere(d.id));
  return (
    <section className={styles.card} aria-label="Where the words are">
      <div className={styles.cardHead}>
        <h2 className={styles.label}>Where the words are</h2>
        <span className={styles.rowMeta}>by {kind}</span>
      </div>
      <div className={styles.bars} onMouseLeave={() => setPointed(null)}>
        {ov.distribution.map((d) => (
          <Link
            key={d.id}
            to={`/stories/${storyId}/write/${d.id}`}
            className={styles.bar}
            data-planned={d.word_count === 0 || undefined}
            data-current={isHere(d.id) || undefined}
            style={{ height: `${Math.max(6, (d.word_count / max) * 100)}%` }}
            onMouseEnter={() => setPointed(d.id)}
            onFocus={() => setPointed(d.id)}
            onBlur={() => setPointed(null)}
            aria-label={`${d.title}, ${d.word_count ? `${d.word_count} words` : "planned"}`}
          />
        ))}
      </div>
      <p className={styles.barsCaption}>
        {shown ? (
          <>
            <span className={styles.barsName}>{shown.title}</span>
            {" · "}
            {shown.word_count ? plural(shown.word_count, "word") : "planned"}
            {isHere(shown.id) && !pointed && " · where you are"}
          </>
        ) : (
          `${ov.distribution.length} ${kind}s; point at one for its words`
        )}
      </p>
    </section>
  );
}

export function CastAndPlaces({ storyId }: { storyId: string }) {
  const { characters, locations, sceneCast } = useStoryStore();
  const findings = useOpenFindings();
  const quiet = new Set(
    findings.filter((f) => f.check === "absent_character").map((f) => f.anchor.character_id),
  );
  const scenesOf = (id: string) =>
    (sceneCast?.scenes ?? []).filter((s) => s.character_ids.includes(id)).length;
  const cast = [...characters].sort((a, b) => scenesOf(b.id) - scenesOf(a.id));
  const places = locations.filter((l) => !l.is_stub && !l.parent_id);
  const SHOWN = 6;
  return (
    <section className={styles.card} aria-label="Cast and places">
      <div className={styles.cardHead}>
        <h2 className={styles.label}>Cast and places</h2>
        <Link to={sectionPath(storyId, "lorebook", "characters")} className={styles.headLink}>
          Lorebook →
        </Link>
      </div>
      {cast.length === 0 ? (
        <p className={styles.quiet}>No one yet.</p>
      ) : (
        <div className={styles.chips}>
          {cast.slice(0, SHOWN).map((c) => (
            <Link
              key={c.id}
              to={sectionPath(storyId, "lorebook", "characters", c.id)}
              className={styles.chip}
              data-quiet={quiet.has(c.id) || undefined}
            >
              <span className={styles.slot} style={{ background: slotVar(c.color_slot) }} aria-hidden />
              {c.name}
              <span className={styles.chipMeta}>
                {quiet.has(c.id) ? "quiet lately" : plural(scenesOf(c.id), "scene")}
              </span>
            </Link>
          ))}
          {cast.length > SHOWN && <span className={styles.chipMeta}>+{cast.length - SHOWN} more</span>}
        </div>
      )}
      {places.length > 0 && (
        <div className={styles.chips}>
          {places.slice(0, SHOWN).map((l) => (
            <Link key={l.id} to={sectionPath(storyId, "lorebook", "places", l.id)} className={styles.chip}>
              <span className={styles.slot} style={{ background: slotVar(l.color_slot) }} aria-hidden />
              {l.name}
            </Link>
          ))}
          {places.length > SHOWN && <span className={styles.chipMeta}>+{places.length - SHOWN} more</span>}
        </div>
      )}
    </section>
  );
}

export function Lately({ storyId, ov }: { storyId: string; ov: StoryOverview }) {
  const rows = [
    ...ov.recent_scenes.slice(0, 3).map((s) => ({
      key: `scene:${s.id}`,
      text: s.title || "Untitled scene",
      meta: `edited ${ago(s.updated_at)} · ${plural(s.word_count, "word")}`,
      at: s.updated_at,
      to: `/stories/${storyId}/write/${s.id}`,
      ai: false,
    })),
    ...ov.recent_activity.slice(0, 4).map((a, i) => ({
      key: `log:${i}`,
      text: a.description,
      meta: ago(a.created_at),
      at: a.created_at,
      to: `/stories/${storyId}/chronicle`,
      ai: a.category === "ai",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  return (
    <section className={styles.card} aria-label="Lately">
      <div className={styles.cardHead}>
        <h2 className={styles.label}>Lately</h2>
        <Link to={`/stories/${storyId}/chronicle`} className={styles.headLink}>
          Chronicle →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className={styles.quiet}>Nothing yet.</p>
      ) : (
        rows.map((r) => (
          <Link key={r.key} to={r.to} className={styles.rowLink}>
            <span className={styles.rowText}>{r.text}</span>
            <span className={styles.rowMeta} data-ai={r.ai || undefined}>
              {r.meta}
            </span>
            <ChevronRight size={14} className={styles.rowGo} aria-hidden />
          </Link>
        ))
      )}
    </section>
  );
}
