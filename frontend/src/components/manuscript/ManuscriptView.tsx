/**
 * ManuscriptView — assembled prose reader.
 *
 * Renders the full story in reading order with act/chapter headings and
 * scene breaks. TipTap content is already HTML so we render it directly.
 * Used in both the Write tab view mode and the Publish page.
 *
 * The Export panel is built in — click the Export button in the toolbar to reveal it.
 */
import { useEffect, useState, useCallback } from "react";
import { BookOpen, RefreshCw, Download, X, Feather, Compass } from "lucide-react";
import { api } from "../../api/client";
import type { Manuscript, ManuscriptSection } from "../../types";
import ExportPanel from "./ExportPanel";
import { useAIAvailable } from "../../lib/mode";
import CompTitlesSuggester from "../publish/CompTitlesSuggester";
import { useAIStore } from "../../stores/aiStore";
import styles from "./ManuscriptView.module.css";

type StatusFilter = "all" | "revised_final" | "final";

interface Props {
  storyId: string;
  /** Called when the user clicks a scene title — omit for read-only mode */
  onNavigateToScene?: (sectionId: string) => void;
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All scenes",
  revised_final: "Revised & Final",
  final: "Final only",
};

const STATUS_FILTER_VALUES: Record<StatusFilter, string | undefined> = {
  all: undefined,
  revised_final: "revised,final",
  final: "final",
};

function headingTag(level: number): "h1" | "h2" | "h3" | "h4" | "h5" {
  const tags: Record<number, "h1" | "h2" | "h3" | "h4" | "h5"> = {
    1: "h1",
    2: "h2",
    3: "h3",
    4: "h4",
    5: "h5",
  };
  return tags[Math.min(level, 5)] ?? "h5";
}

function estimateReadingTime(words: number): string {
  const mins = Math.ceil(words / 250);
  if (mins < 60) return `${mins} min read`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m read` : `${hrs}h read`;
}

function SceneSection({
  section,
  onNavigate,
}: {
  section: ManuscriptSection;
  onNavigate?: (id: string) => void;
}) {
  const Heading = headingTag(section.level);

  return (
    <div className={styles.sceneBlock}>
      {section.heading && section.heading !== "Untitled" && (
        <Heading
          className={`${styles.sceneTitle} ${onNavigate ? styles.sceneTitleClickable : ""}`}
          onClick={onNavigate ? () => onNavigate(section.id) : undefined}
          title={onNavigate ? "Click to open in editor" : undefined}
        >
          {section.heading}
        </Heading>
      )}
      {section.content ? (
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: section.content }} />
      ) : (
        <p className={styles.emptyScene}>
          <em>No content yet.</em>
        </p>
      )}
      <div className={styles.sceneMeta}>
        <span className={`${styles.statusBadge} ${styles[`status_${section.status}`]}`}>
          {section.status}
        </span>
        <span className={styles.wordCount}>{section.word_count.toLocaleString()} words</span>
      </div>
    </div>
  );
}

export default function ManuscriptView({ storyId, onNavigateToScene }: Props) {
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [exportOpen, setExportOpen] = useState(false);
  const aiAvailable = useAIAvailable();
  const [pubPrepOpen, setPubPrepOpen] = useState(false);
  const [showCompTitles, setShowCompTitles] = useState(false);
  const { createSession } = useAIStore();

  const load = useCallback(() => {
    setLoading(true);
    api
      .getManuscript(storyId, STATUS_FILTER_VALUES[statusFilter])
      .then(setManuscript)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const isEmpty = !manuscript || manuscript.sections.filter((s) => s.is_leaf).length === 0;

  return (
    <div className={styles.wrap}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <BookOpen size={14} className={styles.toolbarIcon} />
        <span className={styles.toolbarTitle}>{manuscript?.title ?? "Manuscript"}</span>
        {manuscript && (
          <span className={styles.toolbarMeta}>
            {manuscript.total_words.toLocaleString()} words
            {" · "}
            {estimateReadingTime(manuscript.total_words)}
          </span>
        )}
        <div className={styles.toolbarRight}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_FILTER_LABELS[k]}
              </option>
            ))}
          </select>
          <button className={styles.refreshBtn} onClick={load} title="Refresh">
            <RefreshCw size={13} />
          </button>
          {/* AI tools: absent in Writer mode and with AI switched off. */}
          {aiAvailable && (
            <button
              className={`${styles.exportBtn} ${pubPrepOpen ? styles.exportBtnActive : ""}`}
              onClick={() => {
                setPubPrepOpen((v) => !v);
                setExportOpen(false);
              }}
              title="Publication preparation tools"
            >
              <Feather size={13} />
              Publish Prep
            </button>
          )}
          <button
            className={`${styles.exportBtn} ${exportOpen ? styles.exportBtnActive : ""}`}
            onClick={() => {
              setExportOpen((v) => !v);
              setPubPrepOpen(false);
            }}
            title="Export manuscript"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Body: prose + optional export drawer */}
      <div className={styles.body}>
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading manuscript…</div>
          ) : isEmpty ? (
            <div className={styles.empty}>
              <BookOpen size={32} opacity={0.3} />
              <p>No scenes to display.</p>
              {statusFilter !== "all" && (
                <button className={styles.clearFilter} onClick={() => setStatusFilter("all")}>
                  Show all scenes
                </button>
              )}
            </div>
          ) : (
            <div className={styles.document}>
              <h1 className={styles.documentTitle}>{manuscript?.title}</h1>
              {renderSections(manuscript!.sections, onNavigateToScene)}
            </div>
          )}
        </div>

        {pubPrepOpen && aiAvailable && (
          <div className={styles.exportDrawer}>
            <div className={styles.exportDrawerHeader}>
              <span className={styles.exportDrawerTitle}>Publication Prep</span>
              <button
                className={styles.exportDrawerClose}
                onClick={() => setPubPrepOpen(false)}
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className={styles.pubPrepBody}>
              <p className={styles.pubPrepDesc}>
                AI tools to help prepare your manuscript for submission or self-publishing.
              </p>
              <div className={styles.pubPrepActions}>
                <button
                  className={styles.pubPrepBtn}
                  onClick={() => {
                    createSession("book-description", { storyId });
                    setPubPrepOpen(false);
                  }}
                >
                  <Feather size={14} className={styles.pubPrepBtnIcon} />
                  <div>
                    <div className={styles.pubPrepBtnLabel}>Book Description</div>
                    <div className={styles.pubPrepBtnDesc}>Draft and refine back-cover copy</div>
                  </div>
                </button>
                <button
                  className={styles.pubPrepBtn}
                  onClick={() => {
                    createSession("query-letter", { storyId });
                    setPubPrepOpen(false);
                  }}
                >
                  <Feather size={14} className={styles.pubPrepBtnIcon} />
                  <div>
                    <div className={styles.pubPrepBtnLabel}>Query Letter</div>
                    <div className={styles.pubPrepBtnDesc}>Draft a professional query letter</div>
                  </div>
                </button>
                <button
                  className={`${styles.pubPrepBtn} ${showCompTitles ? styles.pubPrepBtnActive : ""}`}
                  onClick={() => setShowCompTitles((v) => !v)}
                >
                  <Compass size={14} className={styles.pubPrepBtnIcon} />
                  <div>
                    <div className={styles.pubPrepBtnLabel}>Comp Titles</div>
                    <div className={styles.pubPrepBtnDesc}>Suggest comparable published books</div>
                  </div>
                </button>
              </div>
              {showCompTitles && (
                <CompTitlesSuggester storyId={storyId} onClose={() => setShowCompTitles(false)} />
              )}
            </div>
          </div>
        )}

        {exportOpen && (
          <div className={styles.exportDrawer}>
            <div className={styles.exportDrawerHeader}>
              <span className={styles.exportDrawerTitle}>Export</span>
              <button className={styles.exportDrawerClose} onClick={() => setExportOpen(false)} title="Close">
                <X size={13} />
              </button>
            </div>
            <ExportPanel storyId={storyId} />
          </div>
        )}
      </div>
    </div>
  );
}

function renderSections(sections: ManuscriptSection[], onNavigate?: (id: string) => void) {
  const elements: React.ReactNode[] = [];
  let prevWasLeaf = false;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];

    if (s.is_leaf) {
      if (prevWasLeaf) {
        elements.push(
          <div key={`break-${s.id}`} className={styles.sceneBreak}>
            * * *
          </div>,
        );
      }
      elements.push(<SceneSection key={s.id} section={s} onNavigate={onNavigate} />);
      prevWasLeaf = true;
    } else {
      const Heading = headingTag(s.level);
      elements.push(
        <Heading key={s.id} className={styles.structureHeading}>
          {s.heading}
        </Heading>,
      );
      prevWasLeaf = false;
    }
  }

  return elements;
}
