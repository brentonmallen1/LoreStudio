import { AlertCircle, AlertTriangle, Info, User, MapPin } from "lucide-react";
import type {
  ProseNLPResponse,
  EntitySuggestionsResponse,
  EditorialConsistencyResponse,
} from "../../../types";
import styles from "./Analysis.module.css";

/** Local runs read back in the Chronicle: the prose check, the editorial check, the Lorebook scan. */

// ── Prose result renderer ─────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "issue") return <AlertCircle size={11} className={styles.iconIssue} />;
  if (severity === "warning") return <AlertTriangle size={11} className={styles.iconWarning} />;
  return <Info size={11} className={styles.iconInfo} />;
}

export function ProseResultDisplay({ result }: { result: ProseNLPResponse }) {
  const scenes = result.scenes ?? [];
  const scenesWithFindings = scenes.filter(
    (s) =>
      (s.passive_voice?.findings?.length ?? 0) +
        (s.adverb_overuse?.findings?.length ?? 0) +
        (s.said_bookisms?.findings?.length ?? 0) +
        (s.repeated_words?.findings?.length ?? 0) >
      0,
  );

  if (scenes.length === 0) {
    return <p className={styles.empty}>No scenes analyzed.</p>;
  }

  return (
    <div className={styles.proseResults}>
      <p className={styles.proseSummary}>
        {scenesWithFindings.length} of {scenes.length} scene{scenes.length !== 1 ? "s" : ""} have findings
      </p>
      {scenes.map((scene) => {
        const findings = [
          ...(scene.passive_voice?.findings ?? []),
          ...(scene.adverb_overuse?.findings ?? []),
          ...(scene.said_bookisms?.findings ?? []),
          ...(scene.repeated_words?.findings ?? []),
        ];
        if (findings.length === 0 && !scene.sentence_variety) return null;
        return (
          <div key={scene.scene_id} className={styles.sceneBlock}>
            <div className={styles.sceneHeader}>
              <span className={styles.sceneTitle}>{scene.scene_title || "Untitled"}</span>
              {findings.length > 0 && (
                <span className={styles.sceneBadge}>
                  {findings.length} finding{findings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {scene.passive_voice && scene.passive_voice.passive_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Passive voice ({scene.passive_voice.percentage}%)</span>
                {scene.passive_voice.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.adverb_overuse && scene.adverb_overuse.adverb_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Adverbs ({scene.adverb_overuse.adverb_count})</span>
                {scene.adverb_overuse.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.said_bookisms && scene.said_bookisms.bookism_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Said-Bookisms ({scene.said_bookisms.bookism_count})</span>
                {scene.said_bookisms.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.repeated_words && scene.repeated_words.findings.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>
                  Repeated words ({scene.repeated_words.findings.length})
                </span>
                {scene.repeated_words.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Entity suggestions renderer ───────────────────────────────────────────────

export function EntityResultDisplay({ result }: { result: EntitySuggestionsResponse }) {
  const chars = result.character_suggestions ?? [];
  const locs = result.location_suggestions ?? [];
  const total = chars.length + locs.length;
  if (total === 0) return <p className={styles.empty}>No unrecognized entities found.</p>;
  return (
    <div className={styles.entityResults}>
      {chars.length > 0 && (
        <div className={styles.entityGroup}>
          <div className={styles.entityGroupHeader}>
            <User size={12} />
            <span>Characters</span>
            <span className={styles.entityCount}>{chars.length}</span>
          </div>
          {chars.map((s) => (
            <div key={s.text} className={styles.entityRow}>
              <span className={styles.entityName}>{s.text}</span>
              <span className={styles.entityMeta}>
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene
                {s.scene_count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {locs.length > 0 && (
        <div className={styles.entityGroup}>
          <div className={styles.entityGroupHeader}>
            <MapPin size={12} />
            <span>Locations</span>
            <span className={styles.entityCount}>{locs.length}</span>
          </div>
          {locs.map((s) => (
            <div key={s.text} className={styles.entityRow}>
              <span className={styles.entityName}>{s.text}</span>
              <span className={styles.entityMeta}>
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene
                {s.scene_count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editorial consistency renderer ───────────────────────────────────────────

export function EditorialResultDisplay({ result }: { result: EditorialConsistencyResponse }) {
  const scenes = result.scenes ?? [];
  const hasIssues = result.total_tense_shifts > 0 || result.total_pov_flags > 0;

  if (scenes.length === 0) return <p className={styles.empty}>No scenes analyzed.</p>;

  return (
    <div className={styles.proseResults}>
      <p className={styles.proseSummary}>
        {result.total_tense_shifts} tense shift{result.total_tense_shifts !== 1 ? "s" : ""} ·{" "}
        {result.total_pov_flags} POV flag{result.total_pov_flags !== 1 ? "s" : ""} across {scenes.length}{" "}
        scene{scenes.length !== 1 ? "s" : ""}
      </p>
      {!hasIssues && (
        <p className={styles.empty} style={{ fontStyle: "normal", color: "var(--color-success)" }}>
          No editorial issues found.
        </p>
      )}
      {scenes.map((scene) => {
        const tenseIssues = scene.tense_consistency?.findings ?? [];
        const povIssues = scene.pov_drift?.findings ?? [];
        if (tenseIssues.length === 0 && povIssues.length === 0) return null;
        return (
          <div key={scene.scene_id} className={styles.sceneBlock}>
            <div className={styles.sceneHeader}>
              <span className={styles.sceneTitle}>{scene.scene_title || "Untitled"}</span>
              <span className={styles.sceneBadge}>
                {tenseIssues.length + povIssues.length} flag
                {tenseIssues.length + povIssues.length !== 1 ? "s" : ""}
              </span>
            </div>
            {tenseIssues.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>
                  Tense shifts ({tenseIssues.length}), dominant: {scene.tense_consistency?.dominant_tense}
                </span>
                {tenseIssues.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <AlertTriangle size={11} className={styles.iconWarning} />
                    <span className={styles.findingText} title={f.sentence}>
                      {f.sentence.slice(0, 120)}
                      {f.sentence.length > 120 ? "…" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {povIssues.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>POV Drift ({povIssues.length})</span>
                {povIssues.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <AlertTriangle size={11} className={styles.iconWarning} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
