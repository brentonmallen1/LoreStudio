import { useState } from "react";
import { AlertTriangle, Info, Lightbulb, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import type {
  StructuredResult,
  ClicheAnalysisResponse,
  ClicheInstance,
  CharacterDimensionEntry,
  CharacterDimensionalityResult,
  VoiceFidelityResult,
  VoiceFidelityFinding,
} from "../../../types";
import styles from "./Analysis.module.css";

/** Clichés, character depth and voice fidelity read back in the Chronicle. */

// ── Cliche Analysis renderer ──────────────────────────────────────────────────

const SEVERITY_COLOR_CLICHE: Record<string, string> = {
  strong: "var(--color-danger)",
  moderate: "var(--color-warning)",
  subtle: "var(--color-text-muted)",
};

function ClicheInstanceRow({ instance }: { instance: ClicheInstance }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLOR_CLICHE[instance.severity] ?? "var(--color-text-muted)";
  return (
    <div className={styles.issueRow} style={{ alignItems: "flex-start" }}>
      <MinusCircle size={12} style={{ color, flexShrink: 0, marginTop: 3 }} />
      <div className={styles.issueBody}>
        <button
          className={styles.issueLabel}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
          }}
          onClick={() => setOpen((o) => !o)}
        >
          "{instance.passage}"
          <span
            style={{
              marginLeft: 6,
              fontSize: "0.68rem",
              color: "var(--color-text-muted)",
              fontStyle: "normal",
            }}
          >
            [{instance.cliche_type}] · {instance.severity} · {instance.scene_title}
          </span>
        </button>
        {open && (
          <>
            <p className={styles.issueSuggestion}>{instance.explanation}</p>
            {instance.intentional_use_case && (
              <p className={styles.issueMeta}>When it might work: {instance.intentional_use_case}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ClicheResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as ClicheAnalysisResponse;
  return (
    <div>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span className={`${styles.ratingBadge} ${styles[`rating_${data.overall_rating}`]}`}>
          {data.overall_rating?.replace("_", " ") ?? "—"}
        </span>
        <span className={styles.instanceCount}>
          {data.total_count === 0
            ? "No clichés found"
            : `${data.total_count} cliché${data.total_count !== 1 ? "s" : ""} found`}
        </span>
      </div>
      {data.summary && <p className={styles.summaryText}>{data.summary}</p>}
      {data.density_note && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.5rem" }}>
          {data.density_note}
        </p>
      )}
      {data.categories.map(
        (cat, i) =>
          cat.instances.length > 0 && (
            <div key={i} className={styles.checkGroup}>
              <span className={styles.checkLabel}>
                {cat.name} ({cat.count})
              </span>
              {cat.instances.map((inst, j) => (
                <ClicheInstanceRow key={j} instance={inst} />
              ))}
            </div>
          ),
      )}
      {data.strengths.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel} style={{ color: "var(--color-success)" }}>
            Strengths
          </span>
          {data.strengths.map((s, i) => (
            <div key={i} className={styles.issueRow}>
              <CheckCircle size={12} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Character Dimensionality ─────────────────────────────────────────────────

const DIMENSION_COLOR: Record<string, string> = {
  flat: "var(--color-text-muted)",
  developing: "var(--color-warning)",
  dimensional: "var(--color-accent-secondary)",
  complex: "var(--color-ai)",
};

function CharacterDimensionRow({ char }: { char: CharacterDimensionEntry }) {
  const [open, setOpen] = useState(false);
  const color = DIMENSION_COLOR[char.dimension_score] ?? "var(--color-text-muted)";
  return (
    <div className={styles.checkGroup}>
      <button
        className={styles.checkLabel}
        style={{
          background: "none",
          border: "none",
          padding: "0.15rem 0",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          width: "100%",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span style={{ flex: 1 }}>{char.character_name}</span>
        <span style={{ fontSize: "0.68rem", color, fontWeight: 600, textTransform: "capitalize" }}>
          {char.dimension_score}
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
          {char.role}
        </span>
      </button>
      {open && (
        <div style={{ paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {char.strengths.length > 0 && (
            <div>
              <span className={styles.issueMeta} style={{ color: "var(--color-accent-secondary)" }}>
                Strengths
              </span>
              {char.strengths.map((s, i) => (
                <div key={i} className={styles.issueRow}>
                  <CheckCircle
                    size={11}
                    style={{ color: "var(--color-accent-secondary)", flexShrink: 0, marginTop: 2 }}
                  />
                  <span className={styles.issueBody}>{s}</span>
                </div>
              ))}
            </div>
          )}
          {char.gaps.length > 0 && (
            <div>
              <span className={styles.issueMeta} style={{ color: "var(--color-warning)" }}>
                Gaps
              </span>
              {char.gaps.map((g, i) => (
                <div key={i} className={styles.issueRow}>
                  <AlertTriangle
                    size={11}
                    style={{ color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }}
                  />
                  <span className={styles.issueBody}>{g}</span>
                </div>
              ))}
            </div>
          )}
          {char.contradictions && (
            <p className={styles.issueSuggestion}>
              <strong>Contradictions:</strong> {char.contradictions}
            </p>
          )}
          {char.relationship_depth && (
            <p className={styles.issueMeta}>
              <strong>Relationships:</strong> {char.relationship_depth}
            </p>
          )}
          {char.recommendations.length > 0 && (
            <div>
              <span className={styles.issueMeta}>Recommendations</span>
              {char.recommendations.map((r, i) => (
                <div key={i} className={styles.issueRow}>
                  <Lightbulb size={11} style={{ color: "var(--color-ai)", flexShrink: 0, marginTop: 2 }} />
                  <span className={styles.issueBody}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CharacterDimensionalityDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as CharacterDimensionalityResult;
  return (
    <div>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span className={`${styles.ratingBadge} ${styles[`rating_${data.overall_rating}`]}`}>
          {data.overall_rating?.replace("_", " ") ?? "—"}
        </span>
        <span className={styles.instanceCount}>
          {data.characters.length} character{data.characters.length !== 1 ? "s" : ""}
        </span>
      </div>
      {data.summary && <p className={styles.summaryText}>{data.summary}</p>}
      {data.cast_balance && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.5rem" }}>
          {data.cast_balance}
        </p>
      )}
      {(data.characters ?? []).map((char, i) => (
        <CharacterDimensionRow key={i} char={char} />
      ))}
      {data.ensemble_dynamics && (
        <div className={styles.checkGroup} style={{ marginTop: "0.35rem" }}>
          <span className={styles.checkLabel} style={{ color: "var(--color-ai)" }}>
            Ensemble dynamics
          </span>
          <p className={styles.issueSuggestion}>{data.ensemble_dynamics}</p>
        </div>
      )}
    </div>
  );
}

// ── Voice Fidelity renderer ───────────────────────────────────────────────────

const FIDELITY_COLOR: Record<string, string> = {
  excellent: "var(--color-success)",
  good: "var(--color-nlp)",
  fair: "var(--color-warning)",
  needs_work: "var(--color-danger)",
};

const SEVERITY_COLOR_FIDELITY: Record<string, string> = {
  issue: "var(--color-danger)",
  warning: "var(--color-warning)",
  info: "var(--color-text-muted)",
};

const SEVERITY_ICON_FIDELITY: Record<string, React.ElementType> = {
  issue: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function VoiceFidelityDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as VoiceFidelityResult;
  const findings = (data.findings ?? []).filter((f: VoiceFidelityFinding) => f.severity !== "info");

  return (
    <div className={styles.aiResults}>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span
          className={styles.ratingBadge}
          style={{
            background: `color-mix(in srgb, ${FIDELITY_COLOR[data.overall_fidelity] ?? "var(--color-text-muted)"} 15%, transparent)`,
            color: FIDELITY_COLOR[data.overall_fidelity] ?? "var(--color-text-muted)",
          }}
        >
          {data.overall_fidelity?.replace("_", " ") ?? "—"}
        </span>
        {data.character_name && <span className={styles.instanceCount}>{data.character_name}</span>}
      </div>
      {data.attribute_summary && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.4rem" }}>
          {data.attribute_summary}
        </p>
      )}
      {data.summary && <p className={styles.aiSummary}>{data.summary}</p>}

      {findings.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Findings</span>
          {findings.map((f: VoiceFidelityFinding, i: number) => {
            const SevIcon = SEVERITY_ICON_FIDELITY[f.severity] ?? MinusCircle;
            const color = SEVERITY_COLOR_FIDELITY[f.severity] ?? "var(--color-text-muted)";
            return (
              <div key={i} className={styles.issueRow}>
                <SevIcon size={12} style={{ color, flexShrink: 0, marginTop: 2 }} />
                <div className={styles.issueBody}>
                  {f.dialogue_excerpt && (
                    <span className={styles.issueMeta} style={{ fontStyle: "italic" }}>
                      "{f.dialogue_excerpt.slice(0, 100)}
                      {f.dialogue_excerpt.length > 100 ? "…" : ""}"
                    </span>
                  )}
                  <span className={styles.issueLabel}>{f.explanation}</span>
                  {f.attribute_context && <span className={styles.issueMeta}>{f.attribute_context}</span>}
                  {f.suggestion && <p className={styles.issueSuggestion}>{f.suggestion}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.authentic_examples?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel} style={{ color: "var(--color-success)" }}>
            Lines that ring true
          </span>
          {data.authentic_examples.slice(0, 4).map((ex: string, i: number) => (
            <div key={i} className={styles.issueRow}>
              <CheckCircle size={12} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody} style={{ fontStyle: "italic" }}>
                "{ex.slice(0, 100)}
                {ex.length > 100 ? "…" : ""}"
              </span>
            </div>
          ))}
        </div>
      )}

      {data.recommendations?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Recommendations</span>
          {data.recommendations.map((rec: string, i: number) => (
            <div key={i} className={styles.issueRow}>
              <Lightbulb size={12} style={{ color: "var(--color-ai)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody}>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
