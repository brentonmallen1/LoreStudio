import { useState } from "react";
import { Compass, Loader2, X, AlertTriangle, BookOpen, ExternalLink } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./CompTitlesSuggester.module.css";

interface CompTitle {
  title: string;
  author: string;
  year: number;
  reasoning: string;
  similarity_aspects: string[];
}

interface CompTitlesResult {
  suggestions: CompTitle[];
  positioning_note: string;
}

interface Props {
  storyId: string;
  onClose: () => void;
}

export default function CompTitlesSuggester({ storyId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompTitlesResult | null>(null);

  function handleRun() {
    setLoading(true);
    setError(null);
    api
      .suggestCompTitles(storyId)
      .then((res: StructuredResult) => {
        if (!res.success || !res.data) {
          setError(res.raw_text ?? "Analysis failed.");
          return;
        }
        setResult(res.data as unknown as CompTitlesResult);
      })
      .catch((e: Error) => setError(e.message ?? "Analysis failed."))
      .finally(() => setLoading(false));
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.headerIcon} />
          <span className={styles.title}>Comparable Titles</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className={styles.body}>
        {!result && !loading && !error && (
          <div className={styles.intro}>
            <BookOpen size={20} className={styles.introIcon} />
            <p className={styles.introText}>
              Suggest published books similar to yours in genre, tone, and themes — for use in query letters
              and pitch materials.
            </p>
            <button className={styles.runBtn} onClick={handleRun}>
              <Compass size={13} />
              Suggest Comp Titles
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Analyzing story…</span>
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorState}>
            <AlertTriangle size={16} className={styles.errorIcon} />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={handleRun}>
              Try again
            </button>
          </div>
        )}

        {!loading && result && (
          <div className={styles.results}>
            <div className={styles.titleList}>
              {result.suggestions.map((s, i) => (
                <div key={i} className={styles.titleCard}>
                  <div className={styles.titleTop}>
                    <div className={styles.titleMain}>
                      <span className={styles.bookTitle}>{s.title}</span>
                      <span className={styles.bookBy}>by {s.author}</span>
                      <span className={styles.bookYear}>{s.year}</span>
                    </div>
                    <ExternalLink size={12} className={styles.externalIcon} />
                  </div>
                  <p className={styles.reasoning}>{s.reasoning}</p>
                  <div className={styles.aspects}>
                    {s.similarity_aspects.map((a) => (
                      <span key={a} className={styles.aspect}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {result.positioning_note && (
              <div className={styles.positioningNote}>
                <span className={styles.positioningLabel}>Market positioning</span>
                <p>{result.positioning_note}</p>
              </div>
            )}
            <button className={styles.rerunBtn} onClick={handleRun}>
              <Compass size={12} />
              Re-run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
