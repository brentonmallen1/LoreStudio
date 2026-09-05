import { useState } from "react";
import { Compass, BookOpen, User, Target, Heart, Swords, Flame, Repeat } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult, CharacterHealth } from "../../types";
import EssentialQuestionsGuide from "../help/EssentialQuestionsGuide";
import styles from "./EssentialQuestionsPanel.module.css";

const STATUS_LABEL: Record<string, string> = {
  clear: "Clear",
  partial: "Partial",
  unclear: "Unclear",
};

const QUESTION_ICONS = {
  protagonist: User,
  want: Target,
  why: Heart,
  obstacle: Swords,
  stakes: Flame,
  change: Repeat,
};

const QUESTION_LABELS: Record<string, string> = {
  protagonist: "Who is the protagonist?",
  want: "What do they want?",
  why: "Why do they want it?",
  obstacle: "What's stopping them?",
  stakes: "What's at stake?",
  change: "How do they change?",
};

const RATING_LABEL: Record<string, string> = {
  needs_work: "Needs Work",
  fair: "Fair",
  good: "Good",
  excellent: "Excellent",
};

interface QuestionData {
  question?: string;
  status: string;
  evidence: string;
  recommendation: string;
}

interface EssentialQuestionsData {
  protagonist: QuestionData;
  want: QuestionData;
  why: QuestionData;
  obstacle: QuestionData;
  stakes: QuestionData;
  change: QuestionData;
  overall_clarity: string;
  summary: string;
}

interface Props {
  storyId: string;
  characters: CharacterHealth[];
}

export default function EssentialQuestionsPanel({ storyId, characters }: Props) {
  const protagonists = characters.filter((c) => c.role === "protagonist");
  const defaultChar = protagonists[0] ?? characters[0];

  const [selectedId, setSelectedId] = useState<string>(defaultChar?.id ?? "");
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.analyzeEssentialQuestions(storyId, selectedId || undefined);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "Error running Story Compass analysis." });
    } finally {
      setGenerating(false);
    }
  }

  const data = result?.success && result.data ? (result.data as unknown as EssentialQuestionsData) : null;
  const QUESTION_KEYS = ["protagonist", "want", "why", "obstacle", "stakes", "change"] as const;

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Compass size={13} className={styles.icon} />
            <div>
              <h3 className={styles.title}>Story Compass</h3>
              <p className={styles.subtitle}>AI check of the 6 essential questions for a protagonist</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.guideBtn}
              onClick={() => setShowGuide(true)}
              title="Learn about the 6 Essential Questions"
            >
              <BookOpen size={11} />
              What is this?
            </button>
            <button onClick={analyze} disabled={generating || !selectedId} className={styles.analyzeBtn}>
              <Compass size={12} />
              {generating ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
            </button>
          </div>
        </div>

        {characters.length > 1 && (
          <div className={styles.charSelector}>
            <label className={styles.charLabel}>
              <User size={11} />
              Character
            </label>
            <select
              className={styles.charSelect}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setResult(null);
              }}
            >
              {protagonists.length > 0 && (
                <optgroup label="Protagonist(s)">
                  {protagonists.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {characters.filter((c) => c.role !== "protagonist").length > 0 && (
                <optgroup label="Other Characters">
                  {characters
                    .filter((c) => c.role !== "protagonist")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        {generating && <p className={styles.hint}>Analyzing…</p>}

        {!generating && !result && (
          <p className={styles.hint}>
            Checks whether a reader could answer each essential question about your protagonist from the story
            and character data you've defined so far.
          </p>
        )}

        {!generating && result && !data && result.raw_text && (
          <p className={styles.errorHint}>{result.raw_text}</p>
        )}

        {!generating && data && (
          <div className={styles.results}>
            {data.summary && (
              <div className={styles.summary}>
                <span className={`${styles.overallBadge} ${styles[`rating_${data.overall_clarity}`]}`}>
                  {RATING_LABEL[data.overall_clarity] ?? data.overall_clarity}
                </span>
                <p className={styles.summaryText}>{data.summary}</p>
              </div>
            )}

            <div className={styles.questionsGrid}>
              {QUESTION_KEYS.map((key) => {
                const q = data[key];
                if (!q) return null;
                const Icon = QUESTION_ICONS[key];
                return (
                  <div key={key} className={`${styles.questionCard} ${styles[`status_${q.status}`]}`}>
                    <div className={styles.questionHeader}>
                      <Icon size={12} className={styles.questionIcon} />
                      <span className={styles.questionLabel}>{QUESTION_LABELS[key]}</span>
                      <span className={`${styles.statusBadge} ${styles[`badge_${q.status}`]}`}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </div>
                    {q.evidence && <p className={styles.evidence}>{q.evidence}</p>}
                    {q.status !== "clear" && q.recommendation && (
                      <p className={styles.recommendation}>{q.recommendation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showGuide && <EssentialQuestionsGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
