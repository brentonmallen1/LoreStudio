/**
 * Export for a screenplay (doc 25, P3): the script in industry layout, Final Draft or Fountain.
 * The choices here are the preview's too, so the pages beside it are the pages that export.
 */
import { useState } from "react";
import { AlertCircle, Download, FileCode, FileText, FileType2 } from "lucide-react";
import { api } from "../../api/client";
import { saveResponse } from "../../lib/download";
import { useStoryStore } from "../../stores/storyStore";
import type { ScriptExportChoices, ScriptExportFormat, Story, TitlePage } from "../../types";
import styles from "./ExportPanel.module.css";
import own from "./ScriptExportPanel.module.css";

const FORMATS: { key: ScriptExportFormat; label: string; sublabel: string; icon: typeof FileText }[] = [
  {
    key: "screenplay_pdf",
    label: "Screenplay PDF",
    sublabel: "To print or send",
    icon: FileText,
  },
  {
    key: "fdx",
    label: "Final Draft",
    sublabel: ".fdx, for Final Draft",
    icon: FileType2,
  },
  {
    key: "fountain",
    label: "Fountain",
    sublabel: "Plain-text script",
    icon: FileCode,
  },
];

const EMPTY_PAGE: TitlePage = { credit: "Written by", based_on: "", contact: "", draft: "", date: "" };

interface Props {
  storyId: string;
  choices: ScriptExportChoices;
  onChoices: (choices: ScriptExportChoices) => void;
  /** Which scenes, as the manuscript view filters them ("revised,final"). */
  statusFilter?: string;
  /** The title page changed: the preview draws it again. */
  onTitlePage: () => void;
}

export default function ScriptExportPanel({ storyId, choices, onChoices, statusFilter, onTitlePage }: Props) {
  const story = useStoryStore((s) => s.activeStory);
  const [format, setFormat] = useState<ScriptExportFormat>("screenplay_pdf");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ScriptExportChoices>) => onChoices({ ...choices, ...patch });

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await api.exportStory(storyId, {
        format,
        include_headers: false,
        include_scene_titles: false,
        scene_break: "",
        status_filter: statusFilter ? statusFilter.split(",") : null,
        ...choices,
      });
      await saveResponse(res, `screenplay.${format === "screenplay_pdf" ? "pdf" : format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Format</h4>
        <div className={styles.formatList}>
          {FORMATS.map(({ key, label, sublabel, icon: Icon }) => (
            <button
              key={key}
              className={`${styles.formatItem} ${format === key ? styles.formatItemActive : ""}`}
              onClick={() => setFormat(key)}
              type="button"
            >
              <Icon size={14} className={styles.formatIcon} />
              <span className={styles.formatLabel}>{label}</span>
              <span className={styles.formatSublabel}>{sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Options</h4>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={choices.title_page}
            onChange={(e) => set({ title_page: e.target.checked })}
          />
          <span>Title page</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={choices.scene_numbers}
            onChange={(e) => set({ scene_numbers: e.target.checked })}
          />
          <span>Scene numbers (a shooting script)</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={choices.bold_headings}
            onChange={(e) => set({ bold_headings: e.target.checked })}
          />
          <span>Bold scene headings</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={choices.auto_contd}
            onChange={(e) => set({ auto_contd: e.target.checked })}
          />
          <span>(CONT&rsquo;D) when a character speaks again after action</span>
        </label>
        {format === "screenplay_pdf" && (
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="script-page-size">
              Page size
            </label>
            <select
              id="script-page-size"
              className={styles.fieldSelect}
              value={choices.page_size}
              onChange={(e) => set({ page_size: e.target.value as ScriptExportChoices["page_size"] })}
            >
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </div>
        )}
      </div>

      {choices.title_page && story && <TitlePageFields story={story} onSaved={onTitlePage} />}

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}
      <button className={styles.exportBtn} onClick={handleExport} disabled={exporting} type="button">
        <Download size={14} />
        {exporting ? "Exporting…" : "Download"}
      </button>
    </div>
  );
}

/** The title page's words, kept on the story and saved as each field is left. */
function TitlePageFields({ story, onSaved }: { story: Story; onSaved: () => void }) {
  const [page, setPage] = useState<TitlePage>({ ...EMPTY_PAGE, ...story.title_page });
  const [author, setAuthor] = useState(story.author_name);

  async function save(patch: Partial<Story>) {
    const updated = await api.updateStory(story.id, patch);
    useStoryStore.getState().setActiveStory(updated);
    onSaved();
  }
  const field = (key: keyof TitlePage) => ({
    value: page[key],
    onChange: (e: { target: { value: string } }) => setPage({ ...page, [key]: e.target.value }),
    onBlur: () => {
      if (page[key] !== ({ ...EMPTY_PAGE, ...story.title_page } as TitlePage)[key])
        void save({ title_page: page });
    },
  });

  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Title page</h4>
      <div className={own.fields}>
        <label className={own.field}>
          <span>Credit</span>
          <input {...field("credit")} placeholder="Written by" />
        </label>
        <label className={own.field}>
          <span>Author</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            onBlur={() => author !== story.author_name && void save({ author_name: author })}
          />
        </label>
        <label className={own.field}>
          <span>Based on</span>
          <textarea rows={2} {...field("based_on")} placeholder="Based on the novel by…" />
        </label>
        <label className={own.field}>
          <span>Contact</span>
          <textarea rows={3} {...field("contact")} placeholder="Name, email, phone, agent" />
        </label>
        <label className={own.field}>
          <span>Draft</span>
          <input {...field("draft")} placeholder="Second draft" />
        </label>
        <label className={own.field}>
          <span>Date</span>
          <input {...field("date")} />
        </label>
      </div>
    </div>
  );
}
