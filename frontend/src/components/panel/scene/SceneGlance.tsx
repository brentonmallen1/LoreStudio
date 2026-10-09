import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { api } from "../../../api/client";
import { findingsForNode } from "../../../lib/findings/group";
import { isOpen } from "../../../lib/notes/grouping";
import { openScene } from "../../../lib/panel/openScene";
import type { Sequence } from "../../../lib/panel/sequence";
import { useFullNode } from "../../../lib/panel/useFullNode";
import { usePromises } from "../../../lib/promises/usePromises";
import { neighbourLine, sceneSheetPath } from "../../../lib/scene/glance";
import { useSceneFacts } from "../../../lib/scene/useSceneFacts";
import { roleLabel } from "../../../lib/threads/roles";
import { useEditorBridge } from "../../../stores/editorBridge";
import { useOpenFindings } from "../../../stores/findingsStore";
import type { Story, StructureNode } from "../../../types";
import { useStoryNotes } from "../../notes/useStoryNotes";
import styles from "./SceneGlance.module.css";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

/**
 * The This scene tab (doc 24 D19): the scene at a glance, on one screen. Its turn from
 * entry to exit, what happens, who and where, then one line for each part that has
 * something in it (findings, promises, notes, links), and the scenes either side. Nothing
 * is edited here: every line leads to the Scene sheet, where the whole scene is.
 */
export default function SceneGlance({
  node,
  story,
  sequence,
}: {
  node: StructureNode;
  story: Story;
  sequence: Sequence;
}) {
  const findings = findingsForNode(useOpenFindings(), node.id);
  const sheet = sceneSheetPath(story.id, node.id);
  const onSheet = useLocation().pathname === sheet;
  const words = node.word_count ?? 0;
  const { who, where, beat } = useSceneFacts(node, story);
  const [links, setLinks] = useState(0);
  useEffect(() => {
    api
      .getSceneLinks({ node_id: node.id })
      .then((l) => setLinks(l.length))
      .catch(() => setLinks(0));
  }, [node.id]);

  // The editor's live notes while it is open; the saved ones otherwise.
  const live = useEditorBridge((s) => s.notes);
  const saved = useStoryNotes(live ? undefined : story.id, { node_id: node.id });
  const notes = (live ? live.sceneNotes : (saved.notes ?? [])).filter(isOpen);

  const { data: promises } = usePromises(story.id);
  const index = promises?.scenes.find((s) => s.id === node.id)?.index;
  const threads =
    index === undefined
      ? []
      : (promises?.threads ?? []).flatMap((t) => {
          const b = t.beats.find((x) => x.index === index);
          return b ? [`${t.name}, ${roleLabel(b.role)}`] : [];
        });
  const twists =
    index === undefined
      ? 0
      : (promises?.twists ?? []).filter(
          (tw) => tw.reveal_index === index || tw.clues.some((c) => c.index === index),
        ).length;

  const planned = node.entry_state || node.exit_state || node.synopsis;

  return (
    <div className={styles.glance}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{node.title}</h3>
          <p className={styles.meta}>
            {[
              STATUS_LABEL[node.status] ?? node.status,
              `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`,
              `Scene ${sequence.position} of ${sequence.total}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {!onSheet && (
          <Link to={sheet} className={styles.sheetLink} title="Every field of this scene, on one page">
            Scene sheet <ArrowUpRight size={13} aria-hidden />
          </Link>
        )}
      </header>

      {(node.entry_state || node.exit_state) && (
        <dl className={styles.turn} aria-label="The turn">
          {node.entry_state && (
            <>
              <dt>From</dt>
              <dd>{node.entry_state}</dd>
            </>
          )}
          {node.exit_state && (
            <>
              <dt>To</dt>
              <dd>{node.exit_state}</dd>
            </>
          )}
        </dl>
      )}
      {node.synopsis && <p className={styles.synopsis}>{node.synopsis}</p>}
      {!planned && (
        <p className={styles.quiet}>
          Nothing planned for this scene yet. <Link to={sheet}>Plan it on the scene sheet</Link>
        </p>
      )}

      {(who.length > 0 || where.length > 0 || beat || node.in_world_date) && (
        <dl className={styles.facts}>
          {who.length > 0 && (
            <>
              <dt>Who</dt>
              <dd>
                {who.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && " · "}
                    {p.name}
                    {p.pov && <span className={styles.muted}> POV</span>}
                  </span>
                ))}
              </dd>
            </>
          )}
          {where.length > 0 && (
            <>
              <dt>Where</dt>
              <dd>
                {where.map((p, i) => (
                  <span key={p.name} className={p.role === "primary" ? undefined : styles.muted}>
                    {i > 0 && " · "}
                    {p.role === "primary" ? p.name : `${p.role} ${p.name}`}
                  </span>
                ))}
              </dd>
            </>
          )}
          {beat && (
            <>
              <dt>Beat</dt>
              <dd>
                {beat.position_pct}% · {beat.name}
              </dd>
            </>
          )}
          {node.in_world_date && (
            <>
              <dt>When</dt>
              <dd>{node.in_world_date}</dd>
            </>
          )}
        </dl>
      )}

      <div className={styles.rows}>
        {findings.length > 0 && (
          <Row to={`${sheet}#findings`} label="Findings" count={findings.length} line={findings[0].text} />
        )}
        {(threads.length > 0 || twists > 0) && (
          <Row
            to={`${sheet}#promises`}
            label="Promises"
            line={[...threads, twists ? `${twists} ${twists === 1 ? "twist" : "twists"} here` : ""]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
        {notes.length > 0 && (
          <Row to={`${sheet}#notes`} label="Notes" count={notes.length} line={notes[0].content} />
        )}
        {links > 0 && <Row to={`${sheet}#links`} label="Linked scenes" count={links} />}
      </div>

      {(sequence.before || sequence.after) && (
        <section className={styles.sides} aria-label="Either side">
          <h4 className={styles.label}>Either side</h4>
          {sequence.before && <Neighbour id={sequence.before.node.id} side="before" />}
          {sequence.after && <Neighbour id={sequence.after.node.id} side="after" />}
        </section>
      )}
    </div>
  );
}

function Row({ to, label, count, line }: { to: string; label: string; count?: number; line?: string }) {
  return (
    <Link to={to} className={styles.row}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>
          {label}
          {count !== undefined && <span className={styles.count}>{count}</span>}
        </span>
        {line && <span className={styles.rowLine}>{line}</span>}
      </span>
      <ChevronRight size={14} className={styles.chevron} aria-hidden />
    </Link>
  );
}

/** A scene either side in one line; a click opens it to write. */
function Neighbour({ id, side }: { id: string; side: "before" | "after" }) {
  const full = useFullNode(id);
  const title = full?.title ?? "";
  const line = full ? neighbourLine(full, side) : null;
  return (
    <button
      type="button"
      className={styles.neighbour}
      onClick={() => openScene(id)}
      title={`Open “${title}” to write`}
    >
      <span className={styles.neighbourTitle}>{side === "before" ? `← ${title}` : `${title} →`}</span>
      {line && <span className={styles.rowLine}>{line}</span>}
    </button>
  );
}
