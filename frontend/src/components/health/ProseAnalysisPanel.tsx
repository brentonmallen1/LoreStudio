import { useState } from "react";
import { Microscope, ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import type {
  ProseNLPResponse,
  SceneNLPAnalysis,
  PassageFinding,
  SentenceVarietyResult,
} from "../../types";
import styles from "./ProseAnalysisPanel.module.css";

const CHECK_LABELS: Record<string, string> = {
  passive_voice: "Passive Voice",
  adverb_overuse: "Adverb Overuse",
  said_bookisms: "Said-Bookisms",
  repeated_words: "Repeated Words",
  sentence_variety: "Sentence Variety",
};

const ALL_CHECKS = Object.keys(CHECK_LABELS);

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "issue") return <AlertCircle size={11} className={styles.iconIssue} />;
  if (severity === "warning") return <AlertTriangle size={11} className={styles.iconWarning} />;
  return <Info size={11} className={styles.iconInfo} />;
}

function FindingRow({ finding }: { finding: PassageFinding }) {
  return (
    <div className={`${styles.finding} ${styles[`finding_${finding.severity}`]}`}>
      <div className={styles.findingHeader}>
        <SeverityIcon severity={finding.severity} />
        <span className={styles.findingExplanation}>{finding.explanation}</span>
      </div>
      <blockquote className={styles.findingPassage}>{finding.passage}</blockquote>
      {finding.suggestion && (
        <p className={styles.findingSuggestion}>{finding.suggestion}</p>
      )}
    </div>
  );
}

function SentenceVarietyDisplay({ variety }: { variety: SentenceVarietyResult }) {
  const assessmentLabel: Record<string, string> = {
    varied: "Good variety",
    monotonous: "Monotonous — sentences too similar in length",
    erratic: "Erratic — very uneven sentence lengths",
    too_short: "Too few sentences to assess",
  };
  const assessmentClass: Record<string, string> = {
    varied: styles.assessGood,
    monotonous: styles.assessWarn,
    erratic: styles.assessWarn,
    too_short: styles.assessInfo,
  };

  const maxCount = Math.max(...variety.histogram.map(b => b.count), 1);

  return (
    <div className={styles.varietyBlock}>
      <div className={styles.varietyStats}>
        <span>{variety.sentence_count} sentences</span>
        <span>avg {variety.mean_length} words</span>
        <span>σ {variety.std_dev}</span>
      </div>
      <div className={styles.histogram}>
        {variety.histogram.map(bucket => (
          <div key={bucket.label} className={styles.histBar}>
            <div
              className={styles.histFill}
              style={{ height: `${Math.round(bucket.count / maxCount * 100)}%` }}
            />
            <span className={styles.histLabel}>{bucket.label}</span>
          </div>
        ))}
      </div>
      {variety.assessment && (
        <p className={`${styles.assessment} ${assessmentClass[variety.assessment] ?? styles.assessInfo}`}>
          {assessmentLabel[variety.assessment] ?? variety.assessment}
        </p>
      )}
    </div>
  );
}

function SceneResult({ scene }: { scene: SceneNLPAnalysis }) {
  const [expanded, setExpanded] = useState(true);

  const totalFindings =
    (scene.passive_voice?.findings.length ?? 0) +
    (scene.adverb_overuse?.findings.length ?? 0) +
    (scene.said_bookisms?.findings.length ?? 0) +
    (scene.repeated_words?.findings.length ?? 0);

  const hasIssues = totalFindings > 0;

  return (
    <div className={styles.sceneBlock}>
      <button className={styles.sceneHeader} onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className={styles.sceneTitle}>{scene.scene_title || "Untitled scene"}</span>
        <span className={styles.sceneWordCount}>{scene.word_count.toLocaleString()} words</span>
        {!hasIssues && !scene.sentence_variety && (
          <span className={styles.sceneBadgeClean}>No issues</span>
        )}
        {hasIssues && (
          <span className={styles.sceneBadgeCount}>{totalFindings} finding{totalFindings !== 1 ? "s" : ""}</span>
        )}
      </button>

      {expanded && (
        <div className={styles.sceneContent}>
          {/* Passive voice */}
          {scene.passive_voice && (
            <div className={styles.checkSection}>
              <div className={styles.checkHeader}>
                <span className={styles.checkLabel}>Passive Voice</span>
                <span className={styles.checkStat}>
                  {scene.passive_voice.passive_count}/{scene.passive_voice.sentence_count} sentences ({scene.passive_voice.percentage}%)
                </span>
              </div>
              {scene.passive_voice.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
            </div>
          )}

          {/* Adverb overuse */}
          {scene.adverb_overuse && scene.adverb_overuse.adverb_count > 0 && (
            <div className={styles.checkSection}>
              <div className={styles.checkHeader}>
                <span className={styles.checkLabel}>Adverb Overuse</span>
                <span className={styles.checkStat}>
                  {scene.adverb_overuse.adverb_count} adverbs ({scene.adverb_overuse.percentage}% of words,
                  threshold {scene.adverb_overuse.threshold}%)
                </span>
              </div>
              {scene.adverb_overuse.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
            </div>
          )}

          {/* Said-bookisms */}
          {scene.said_bookisms && scene.said_bookisms.bookism_count > 0 && (
            <div className={styles.checkSection}>
              <div className={styles.checkHeader}>
                <span className={styles.checkLabel}>Said-Bookisms</span>
                <span className={styles.checkStat}>
                  {scene.said_bookisms.bookism_count} of {scene.said_bookisms.total_attributions} attribution verbs
                </span>
              </div>
              {scene.said_bookisms.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
            </div>
          )}

          {/* Repeated words */}
          {scene.repeated_words && scene.repeated_words.findings.length > 0 && (
            <div className={styles.checkSection}>
              <div className={styles.checkHeader}>
                <span className={styles.checkLabel}>Repeated Words</span>
                <span className={styles.checkStat}>
                  {scene.repeated_words.findings.length} repetition{scene.repeated_words.findings.length !== 1 ? "s" : ""} within {scene.repeated_words.window_chars} chars
                </span>
              </div>
              {scene.repeated_words.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
            </div>
          )}

          {/* Sentence variety */}
          {scene.sentence_variety && scene.sentence_variety.sentence_count > 0 && (
            <div className={styles.checkSection}>
              <div className={styles.checkHeader}>
                <span className={styles.checkLabel}>Sentence Variety</span>
              </div>
              <SentenceVarietyDisplay variety={scene.sentence_variety} />
            </div>
          )}

          {totalFindings === 0 && !scene.sentence_variety && (
            <p className={styles.noFindings}>No findings for this scene.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  storyId: string;
}

export default function ProseAnalysisPanel({ storyId }: Props) {
  const [result, setResult] = useState<ProseNLPResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<Set<string>>(new Set(ALL_CHECKS));

  function toggleCheck(key: string) {
    setSelectedChecks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runAnalysis() {
    setResult(null);
    setRunning(true);
    try {
      const checks = selectedChecks.size === ALL_CHECKS.length ? undefined : [...selectedChecks];
      const r = await api.analyzeProseNLP(storyId, undefined, checks);
      setResult(r);
    } catch {
      // leave result null — error shown implicitly
    } finally {
      setRunning(false);
    }
  }

  const scenesWithFindings = result?.scenes.filter(s =>
    (s.passive_voice?.findings.length ?? 0) +
    (s.adverb_overuse?.findings.length ?? 0) +
    (s.said_bookisms?.findings.length ?? 0) +
    (s.repeated_words?.findings.length ?? 0) > 0 ||
    (s.sentence_variety?.sentence_count ?? 0) > 0
  ) ?? [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Microscope size={13} className={styles.icon} />
          <div>
            <h3 className={styles.title}>Prose Analysis</h3>
            <p className={styles.subtitle}>
              Local NLP analysis — passive voice, adverbs, bookisms, repetition, sentence variety
            </p>
          </div>
        </div>
        <button onClick={runAnalysis} disabled={running || selectedChecks.size === 0} className={styles.runBtn}>
          <Microscope size={12} />
          {running ? "Analyzing…" : result ? "Re-run" : "Analyze"}
        </button>
      </div>

      {/* Check toggles */}
      <div className={styles.checkToggles}>
        {ALL_CHECKS.map(key => (
          <button
            key={key}
            className={`${styles.toggle} ${selectedChecks.has(key) ? styles.toggleOn : ""}`}
            onClick={() => toggleCheck(key)}
          >
            {CHECK_LABELS[key]}
          </button>
        ))}
      </div>

      {running && <p className={styles.hint}>Running analysis on all scenes…</p>}

      {!running && result && (
        <div className={styles.results}>
          {scenesWithFindings.length === 0 ? (
            <p className={styles.hint}>No findings across {result.scenes.length} scene{result.scenes.length !== 1 ? "s" : ""}.</p>
          ) : (
            <>
              <p className={styles.summary}>
                {scenesWithFindings.length} of {result.scenes.length} scene{result.scenes.length !== 1 ? "s" : ""} have findings
              </p>
              {result.scenes.map(scene => (
                <SceneResult key={scene.scene_id} scene={scene} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
