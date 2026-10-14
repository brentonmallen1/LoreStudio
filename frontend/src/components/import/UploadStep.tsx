import { useEffect, useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { api } from "../../api/client";
import { isScriptFile, SCRIPT_FILES, templatesFor } from "../../lib/storyFormat";
import type { ImportUploadResponse, StoryStructureTemplate } from "../../types";
import styles from "./UploadStep.module.css";

interface Props {
  onUploaded: (resp: ImportUploadResponse) => void;
}

const ACCEPTED = [".docx", ".doc", ".rtf", ".md", ".markdown", ".txt", ".epub", ".zip", ...SCRIPT_FILES].join(
  ",",
);
const ACCEPTED_LABEL =
  "DOCX, DOC, RTF, Markdown, plain text, ePub; scripts in Fountain or Final Draft; a Novelcrafter export (.zip)";

export default function UploadStep({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState("freeform");
  const [templates, setTemplates] = useState<StoryStructureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listStructureTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  // A script file comes in as a screenplay: its structures are the ones offered (doc 25, P6).
  const script = file !== null && isScriptFile(file.name);
  const offered = templatesFor(templates, script ? "screenplay" : "prose");

  function handleFile(f: File) {
    setFile(f);
    setError(null);
    if (isScriptFile(f.name)) setTemplateId("screenplay");
    else if (templates.find((t) => t.id === templateId)?.format === "screenplay") setTemplateId("freeform");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.importUpload(file, templateId);
      onUploaded(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className={styles.root}>
      <p className={styles.hint}>
        Import a document and map it to your story's structure. Your writing is never altered; the import
        wizard only decides where the breaks go. A Fountain or Final Draft script comes in as a screenplay, a
        scene at each heading. A Novelcrafter export (its full .zip) brings its codex, snippets and
        conversations too, and shows you where each will go.
      </p>

      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${dragging ? styles.dragging : ""} ${file ? styles.hasFile : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className={styles.hiddenInput}
        />
        {file ? (
          <>
            <FileText size={28} className={styles.fileIcon} />
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
            <span className={styles.changeHint}>Click or drop to replace</span>
          </>
        ) : (
          <>
            <Upload size={28} className={styles.uploadIcon} />
            <span className={styles.dropLabel}>Drop your document here</span>
            <span className={styles.dropSub}>or click to browse</span>
            <span className={styles.formats}>{ACCEPTED_LABEL}</span>
          </>
        )}
      </div>

      {/* Template select */}
      <div className={styles.field}>
        <label className={styles.label}>Target structure template</label>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={styles.select}>
          {offered.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {!t.is_system ? " (custom)" : ""}
            </option>
          ))}
        </select>
        {selectedTemplate && (
          <p className={styles.templateHint}>
            Levels: {selectedTemplate.levels.map((l) => l.name).join(" → ")}
          </p>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button onClick={handleUpload} disabled={!file || loading} className={styles.importBtn}>
          {loading ? "Parsing document…" : "Import & detect structure"}
        </button>
      </div>
    </div>
  );
}
