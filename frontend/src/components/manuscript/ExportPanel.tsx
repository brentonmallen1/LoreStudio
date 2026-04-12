/**
 * ExportPanel — format selector + options + download.
 * Calls POST /stories/{id}/export, receives a binary file, triggers browser download.
 */
import { useState } from "react";
import { Download, FileText, FileCode, BookOpen, FileType2, AlertCircle } from "lucide-react";
import { api } from "../../api/client";
import type { ExportOptions } from "../../types";
import styles from "./ExportPanel.module.css";

interface Props {
  storyId: string;
}

type FormatKey = ExportOptions["format"];
type PdfLayout = NonNullable<ExportOptions["pdf_layout"]>;

const FORMATS: {
  key: FormatKey;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}[] = [
  { key: "docx",            label: "DOCX",              sublabel: "Microsoft Word",             icon: FileType2 },
  { key: "docx_manuscript", label: "DOCX — Manuscript", sublabel: "Standard manuscript format", icon: FileType2 },
  { key: "epub",            label: "ePub",              sublabel: "E-reader format",            icon: BookOpen  },
  { key: "markdown",        label: "Markdown",          sublabel: "Plain text with formatting", icon: FileCode  },
  { key: "txt",             label: "Plain Text",        sublabel: "For submission systems",     icon: FileText  },
  { key: "html",            label: "HTML",              sublabel: "Web / print to PDF",         icon: FileText  },
  { key: "odt",             label: "ODT",               sublabel: "LibreOffice / OpenDocument", icon: FileType2 },
  { key: "pdf",             label: "PDF",               sublabel: "Print-ready document",       icon: FileText  },
];

const PDF_LAYOUTS: { key: PdfLayout; label: string; desc: string }[] = [
  { key: "default",    label: "Default",     desc: "LoreStudio default styling" },
  { key: "novel",      label: "Novel",       desc: "Georgia serif, generous margins, indented paragraphs" },
  { key: "manuscript", label: "Manuscript",  desc: "Courier, double-spaced, industry standard" },
  { key: "compact",    label: "Compact",     desc: "Sans-serif, tighter leading, for screen reading" },
  { key: "dark",       label: "Dark Mode",   desc: "Dark background, warm text" },
];

const SCENE_BREAKS = ["* * *", "---", "###", ""];

export default function ExportPanel({ storyId }: Props) {
  const [format, setFormat] = useState<FormatKey>("docx");
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeSceneTitles, setIncludeSceneTitles] = useState(false);
  const [titlePage, setTitlePage] = useState(true);
  const [sceneBreak, setSceneBreak] = useState("* * *");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pdfLayout, setPdfLayout] = useState<PdfLayout>("default");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const sf: string[] | null =
        statusFilter === "all" ? null :
        statusFilter === "revised_final" ? ["revised", "final"] :
        ["final"];

      const options: ExportOptions = {
        format,
        include_headers: includeHeaders,
        include_scene_titles: includeSceneTitles,
        title_page: titlePage,
        scene_break: sceneBreak,
        status_filter: sf,
        ...(format === "pdf" && pdfLayout !== "default" ? { pdf_layout: pdfLayout } : {}),
      };

      const res = await api.exportStory(storyId, options);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Export failed (${res.status})`);
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const ext = format === "docx_manuscript" ? "docx" : format === "markdown" ? "md" : format === "txt" ? "txt" : format;
      const filename = match?.[1] ?? `manuscript.${ext}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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
          <input type="checkbox" checked={titlePage} onChange={(e) => setTitlePage(e.target.checked)} />
          <span>Title page</span>
        </label>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={includeHeaders} onChange={(e) => setIncludeHeaders(e.target.checked)} />
          <span>Include act / chapter headings</span>
        </label>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={includeSceneTitles} onChange={(e) => setIncludeSceneTitles(e.target.checked)} />
          <span>Include scene titles</span>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Scene break</label>
          <select
            className={styles.fieldSelect}
            value={sceneBreak}
            onChange={(e) => setSceneBreak(e.target.value)}
          >
            {SCENE_BREAKS.map((b) => (
              <option key={b} value={b}>{b === "" ? "(blank line)" : b}</option>
            ))}
          </select>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Include scenes</label>
          <select
            className={styles.fieldSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All scenes</option>
            <option value="revised_final">Revised &amp; Final only</option>
            <option value="final">Final only</option>
          </select>
        </div>

        {format === "pdf" && (
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>PDF layout</label>
            <select
              className={styles.fieldSelect}
              value={pdfLayout}
              onChange={(e) => setPdfLayout(e.target.value as PdfLayout)}
            >
              {PDF_LAYOUTS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      <button
        className={styles.exportBtn}
        onClick={handleExport}
        disabled={exporting}
        type="button"
      >
        <Download size={14} />
        {exporting ? "Exporting…" : "Download"}
      </button>

      {format === "html" && (
        <p className={styles.hint}>
          HTML can be opened in any browser and printed to PDF via File → Print.
        </p>
      )}
      {format === "txt" && (
        <p className={styles.hint}>
          Plain text strips all formatting — suitable for manuscript submission portals.
        </p>
      )}
    </div>
  );
}
