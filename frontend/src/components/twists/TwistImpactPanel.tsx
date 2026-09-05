import { useState } from "react";
import { Compass, RefreshCw, GitBranch, User, Film, AlertTriangle, Zap } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./TwistImpactPanel.module.css";

interface Props {
  twistId: string;
  twistName: string;
}

type AnyRecord = Record<string, unknown>;

function str(v: unknown): string {
  return String(v ?? "");
}
function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStringList(v: unknown): string[] {
  return asList(v).map(str);
}

export default function TwistImpactPanel({ twistId, twistName }: Props) {
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setResult(null);
    setLoading(true);
    try {
      const r = await api.analyzeTwistImpact(twistId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Analysis failed. Check that Ollama is running." });
    } finally {
      setLoading(false);
    }
  }

  const data = result?.success ? (result.data as AnyRecord) : null;
  const affectedThreads = asList(data?.affected_threads) as AnyRecord[];
  const affectedArcs = asList(data?.affected_arcs) as AnyRecord[];
  const scenesToReview = asList(data?.scenes_to_review) as AnyRecord[];
  const looseEnds = asStringList(data?.loose_ends);
  const rippleEffects = asList(data?.ripple_effects) as AnyRecord[];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.icon} />
          <div>
            <h4 className={styles.title}>Twist Impact</h4>
            <p className={styles.subtitle}>Downstream effects when "{twistName}" resolves</p>
          </div>
        </div>
        <button
          className={styles.analyzeBtn}
          onClick={analyze}
          disabled={loading}
          title="Trace which threads, character arcs, and scenes are affected when this twist resolves"
        >
          <Compass size={12} className={loading ? styles.spin : undefined} />
          {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze impact"}
        </button>
      </div>

      {!loading && !result && (
        <p className={styles.hint}>
          Find out which threads, arcs, and scenes need revisiting when this twist resolves.
        </p>
      )}

      {!loading && result && !result.success && (
        <p className={styles.hint}>{result.raw_text || "Analysis failed."}</p>
      )}

      {loading && (
        <div className={styles.loadingRow}>
          <RefreshCw size={14} className={styles.spin} />
          <span>Tracing downstream effects…</span>
        </div>
      )}

      {data && !loading && (
        <div className={styles.sections}>
          {/* Overall assessment */}
          {str(data.overall_assessment) && (
            <div className={styles.assessmentBox}>
              <p className={styles.assessmentText}>{str(data.overall_assessment)}</p>
            </div>
          )}

          {/* Affected threads */}
          {affectedThreads.length > 0 && (
            <ImpactSection
              icon={<GitBranch size={12} />}
              title="Affected Plot Threads"
              color="var(--color-accent)"
            >
              {affectedThreads.map((t, i) => (
                <div key={i} className={styles.impactRow}>
                  <span className={styles.impactName}>{str(t.thread_name)}</span>
                  <p className={styles.impactDetail}>{str(t.impact)}</p>
                </div>
              ))}
            </ImpactSection>
          )}

          {/* Affected arcs */}
          {affectedArcs.length > 0 && (
            <ImpactSection
              icon={<User size={12} />}
              title="Character Arc Changes"
              color="var(--color-accent-secondary, #0d9488)"
            >
              {affectedArcs.map((a, i) => (
                <div key={i} className={styles.impactRow}>
                  <span className={styles.impactName}>{str(a.character_name)}</span>
                  <p className={styles.impactDetail}>{str(a.arc_change)}</p>
                </div>
              ))}
            </ImpactSection>
          )}

          {/* Scenes to review */}
          {scenesToReview.length > 0 && (
            <ImpactSection icon={<Film size={12} />} title="Scenes to Review" color="var(--color-warning)">
              {scenesToReview.map((s, i) => (
                <div key={i} className={styles.impactRow}>
                  <span className={styles.impactName}>{str(s.scene_title)}</span>
                  <p className={styles.impactDetail}>{str(s.reason)}</p>
                </div>
              ))}
            </ImpactSection>
          )}

          {/* Ripple effects */}
          {rippleEffects.length > 0 && (
            <ImpactSection
              icon={<Zap size={12} />}
              title="Ripple Effects"
              color="var(--segment-beat, #a855f7)"
            >
              {rippleEffects.map((r, i) => (
                <div key={i} className={styles.impactRow}>
                  <span className={styles.impactName}>{str(r.area)}</span>
                  <p className={styles.impactDetail}>{str(r.description)}</p>
                </div>
              ))}
            </ImpactSection>
          )}

          {/* Loose ends */}
          {looseEnds.length > 0 && (
            <ImpactSection icon={<AlertTriangle size={12} />} title="Loose Ends" color="#c83c3c">
              <ul className={styles.looseEndList}>
                {looseEnds.map((end, i) => (
                  <li key={i} className={styles.looseEndItem}>
                    {end}
                  </li>
                ))}
              </ul>
            </ImpactSection>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactSection({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section} style={{ borderLeftColor: color }}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} style={{ color }}>
          {icon}
        </span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
