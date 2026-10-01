import { streamAnswer } from "../../lib/ai/eventStream";
import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Edit2, Check, X, ImageIcon, FileText, Compass, Copy, ZoomIn } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { sectionPath } from "../../lib/routes";
import type { StoryAsset } from "../../types";
import Lightbox from "./Lightbox";
import UsedBy from "./UsedBy";
import styles from "./MediaLibrary.module.css";
import AIOnly from "../ai/AIOnly";

interface Props {
  storyId: string;
  assets: StoryAsset[];
  onAssetsChange: (assets: StoryAsset[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetCard({
  asset,
  onDelete,
  onUpdate,
  onLightbox,
}: {
  asset: StoryAsset;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { alt_text?: string; description?: string }) => void;
  onLightbox?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [altText, setAltText] = useState(asset.alt_text);
  const [description, setDescription] = useState(asset.description);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isImage = asset.mime_type.startsWith("image/");
  const fileUrl = api.assetFileUrl(asset.id);

  async function saveEdit() {
    await onUpdate(asset.id, { alt_text: altText, description });
    setEditing(false);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysis("");
    setShowAnalysis(true);
    try {
      const res = await api.analyzeImage(asset.id);
      if (!res.body) return;
      const { error } = await streamAnswer(res, setAnalysis);
      if (error) setAnalysis(error);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className={styles.card}>
      <div
        className={`${styles.cardThumb} ${isImage && onLightbox ? styles.cardThumbClickable : ""}`}
        onClick={isImage ? onLightbox : undefined}
        title={isImage ? "View full size" : undefined}
      >
        {isImage ? (
          <>
            <img
              src={fileUrl}
              alt={asset.alt_text || asset.original_filename}
              className={styles.thumb}
              loading="lazy"
              decoding="async"
            />
            {onLightbox && (
              <span className={styles.thumbZoom}>
                <ZoomIn size={13} />
              </span>
            )}
          </>
        ) : (
          <div className={styles.thumbPlaceholder}>
            <FileText size={28} />
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        {editing ? (
          <div className={styles.editForm}>
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Alt text / caption…"
              className={styles.editInput}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (author notes)…"
              className={styles.editTextarea}
              rows={2}
            />
            <div className={styles.editActions}>
              <button onClick={saveEdit} className={styles.saveBtn}>
                <Check size={12} /> Save
              </button>
              <button onClick={() => setEditing(false)} className={styles.cancelBtn}>
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link
              to={sectionPath(asset.story_id, "compendium", "images", asset.id)}
              className={styles.fileName}
              title={`Open ${asset.original_filename}`}
            >
              {asset.original_filename}
            </Link>
            {asset.alt_text && <p className={styles.altText}>{asset.alt_text}</p>}
            {asset.description && <p className={styles.desc}>{asset.description}</p>}
            <p className={styles.meta}>
              {formatBytes(asset.size_bytes)} · {asset.mime_type}
            </p>
            <UsedBy attachments={asset.attachments ?? []} />
          </>
        )}

        <div className={styles.cardActions}>
          <button onClick={() => setEditing((v) => !v)} className={styles.actionBtn} title="Edit metadata">
            <Edit2 size={12} />
          </button>
          {isImage && (
            <AIOnly>
              <button
                onClick={runAnalysis}
                className={styles.actionBtn}
                title="AI: analyze mood & atmosphere"
                disabled={analyzing}
              >
                <Compass size={12} />
              </button>
            </AIOnly>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(fileUrl)}
            className={styles.actionBtn}
            title="Copy URL"
          >
            <Copy size={12} />
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete(asset.id)}
                className={`${styles.actionBtn} ${styles.danger}`}
                title="Confirm delete"
              >
                <Check size={12} />
              </button>
              <button onClick={() => setConfirmDelete(false)} className={styles.actionBtn}>
                <X size={12} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className={`${styles.actionBtn} ${styles.danger}`}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {showAnalysis && (
          <div className={styles.analysisBox}>
            <div className={styles.analysisHeader}>
              <span>AI Analysis</span>
              <button onClick={() => setShowAnalysis(false)} className={styles.cancelBtn}>
                <X size={11} />
              </button>
            </div>
            <p className={styles.analysisText}>
              {analyzing && !analysis ? "Analyzing…" : analysis || "No response."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaLibrary({ storyId, assets, onAssetsChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<"all" | "images" | "documents">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageAssets = assets.filter((a) => a.mime_type.startsWith("image/"));

  const filtered = assets.filter((a) => {
    if (filter === "images") return a.mime_type.startsWith("image/");
    if (filter === "documents") return !a.mime_type.startsWith("image/");
    return true;
  });

  async function handleFiles(files: FileList) {
    setUploading(true);
    const uploaded: StoryAsset[] = [];
    for (const file of Array.from(files)) {
      try {
        const asset = await api.uploadAsset(storyId, file);
        uploaded.push(asset);
      } catch (e) {
        console.error("Upload failed:", e);
      }
    }
    onAssetsChange([...uploaded, ...assets]);
    setUploading(false);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [assets],
  );

  async function handleDelete(assetId: string) {
    await api.deleteAsset(assetId);
    onAssetsChange(assets.filter((a) => a.id !== assetId));
  }

  async function handleUpdate(assetId: string, data: { alt_text?: string; description?: string }) {
    const updated = await api.updateAsset(assetId, data);
    onAssetsChange(assets.map((a) => (a.id === assetId ? updated : a)));
  }

  return (
    <div className={styles.library}>
      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {(["all", "images", "documents"] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filterTab} ${filter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "images" ? "Images" : "Documents"}
              <span className={styles.filterCount}>
                {f === "all"
                  ? assets.length
                  : f === "images"
                    ? assets.filter((a) => a.mime_type.startsWith("image/")).length
                    : assets.filter((a) => !a.mime_type.startsWith("image/")).length}
              </span>
            </button>
          ))}
        </div>
        <button
          className={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={13} />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/plain"
          className={styles.fileInput}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div
        className={`${styles.dropZone} ${dragOver ? styles.dropActive : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <ImageIcon size={32} />
            <p>Drop images or documents here, or click Upload</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onLightbox={
                  asset.mime_type.startsWith("image/")
                    ? () => {
                        const idx = imageAssets.findIndex((a) => a.id === asset.id);
                        setLightboxIndex(idx >= 0 ? idx : null);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null &&
        (() => {
          const asset = imageAssets[lightboxIndex];
          if (!asset) return null;
          return (
            <Lightbox
              url={api.assetFileUrl(asset.id)}
              alt={asset.alt_text || asset.original_filename}
              filename={asset.original_filename}
              onClose={() => setLightboxIndex(null)}
              onPrev={lightboxIndex > 0 ? () => setLightboxIndex((i) => (i ?? 1) - 1) : undefined}
              onNext={
                lightboxIndex < imageAssets.length - 1
                  ? () => setLightboxIndex((i) => (i ?? 0) + 1)
                  : undefined
              }
            />
          );
        })()}
    </div>
  );
}
