import { useState, useEffect } from "react";
import { X, Compass, Loader2, AlertTriangle, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./OutlineAlignmentPanel.module.css";

interface AlignmentItem {
  outline_text: string;
  status: "covered" | "partial" | "missing";
  evidence: string;
  scene_references: string[];
}

interface AlignmentResult {
  covered_beats: AlignmentItem[];
  missing_beats: AlignmentItem[];
  unplanned_content: string[];
  divergences: string[];
  recommendations: string[];
  coverage_score: number;
}

interface Props {
  outlineId: string;
  onClose: () => void;
}

function StatusIcon({ status }: { status: AlignmentItem["status"] }) {
  if (status === "covered") return <CheckCircle size={13} className={styles.iconCovered} />;
  if (status === "partial") return <MinusCircle size={13} className={styles.iconPartial} />;
  return <XCircle size={13} className={styles.iconMissing} />;
}

function BeatRow({ item }: { item: AlignmentItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.beatRow} ${styles[`beat_${item.status}`]}`}>
      <div className={styles.beatHeader} onClick={() => setOpen((v) => !v)}>
        <StatusIcon status={item.status} />
        <span className={styles.beatText}>{item.outline_text}</span>
        {item.scene_references.length > 0 && (
          <span className={styles.beatScenes}>{item.scene_references.join(", ")}</span>
        )}
      </div>
      {open && item.evidence && (
        <p className={styles.beatEvidence}>{item.evidence}</p>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? "var(--color-success, #22c55e)" : pct >= 40 ? "var(--color-warning, #d97706)" : "var(--color-error, #ef4444)";
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreTrack}>
        <div
          className={styles.scoreFill}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className={styles.scoreLabel} style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function OutlineAlignmentPanel({ outlineId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AlignmentResult | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.analyzeOutlineAlignment(outlineId)
      .then((res: StructuredResult) => {
        if (!res.success || !res.data) {
          setError(res.raw_text ?? "Analysis failed.");
          return;
        }
        setResult(res.data as unknown as AlignmentResult);
      })
      .catch((e: Error) => setError(e.message ?? "Analysis failed."))
      .finally(() => setLoading(false));
  }, [outlineId]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.headerIcon} />
          <span className={styles.title}>Outline Alignment</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className={styles.body}>
        {loading && (
          <div className={styles.loading}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Analyzing alignment…</span>
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorState}>
            <AlertTriangle size={16} className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}

        {!loading && result && (
          <div className={styles.results}>
            {/* Coverage score */}
            <div className={styles.scoreSection}>
              <span className={styles.scoreName}>Coverage</span>
              <ScoreBar score={result.coverage_score} />
            </div>

            {/* Covered beats */}
            {result.covered_beats.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <CheckCircle size={12} className={styles.iconCovered} />
                  Covered ({result.covered_beats.length})
                </h4>
                <div className={styles.beatList}>
                  {result.covered_beats.map((item, i) => (
                    <BeatRow key={i} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Missing beats */}
            {result.missing_beats.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <XCircle size={12} className={styles.iconMissing} />
                  Missing ({result.missing_beats.length})
                </h4>
                <div className={styles.beatList}>
                  {result.missing_beats.map((item, i) => (
                    <BeatRow key={i} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Unplanned content */}
            {result.unplanned_content.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Unplanned Content</h4>
                <ul className={styles.simpleList}>
                  {result.unplanned_content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Divergences */}
            {result.divergences.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Divergences</h4>
                <ul className={styles.simpleList}>
                  {result.divergences.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Recommendations</h4>
                <ul className={styles.simpleList}>
                  {result.recommendations.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
