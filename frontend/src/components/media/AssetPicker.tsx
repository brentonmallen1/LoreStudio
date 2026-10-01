import { useState, useEffect, useRef } from "react";
import { Paperclip, X, Upload, ImageIcon, FileText, ChevronDown, ChevronUp, ZoomIn } from "lucide-react";
import { api } from "../../api/client";
import type { StoryAsset, AssetAttachment } from "../../types";
import Lightbox from "./Lightbox";
import styles from "./AssetPicker.module.css";

interface Props {
  storyId: string;
  objectType: string;
  objectId: string;
  label?: string;
  onAttachmentsChange?: () => void;
}

export default function AssetPicker({
  storyId,
  objectType,
  objectId,
  label = "Reference images",
  onAttachmentsChange,
}: Props) {
  const [attachments, setAttachments] = useState<AssetAttachment[]>([]);
  const [storyAssets, setStoryAssets] = useState<StoryAsset[]>([]);
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only shows non-portrait attachments — portrait is managed by PortraitEditor
  const refAttachments = attachments.filter((a) => a.role !== "portrait");

  useEffect(() => {
    if (!objectId) return;
    setLoading(true);
    api
      .listAttachments(objectType, objectId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false));
  }, [objectType, objectId]);

  async function loadStoryAssets() {
    const assets = await api.listAssets(storyId);
    setStoryAssets(assets);
  }

  async function openBrowser() {
    setBrowsing(true);
    await loadStoryAssets();
  }

  async function attach(assetId: string) {
    const att = await api.attachAsset(assetId, objectType, objectId, "reference");
    setAttachments((prev) => {
      const exists = prev.find((a) => a.id === att.id);
      return exists ? prev.map((a) => (a.id === att.id ? att : a)) : [...prev, att];
    });
    onAttachmentsChange?.();
  }

  async function detach(attachmentId: string) {
    await api.detachAsset(attachmentId);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    onAttachmentsChange?.();
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const asset = await api.uploadAsset(storyId, file);
        await attach(asset.id);
        setStoryAssets((prev) => [asset, ...prev]);
      } catch (e) {
        console.error("Upload failed", e);
      }
    }
    setUploading(false);
  }

  // image-only attachments in display order, for lightbox prev/next
  const imageAttachments = refAttachments.filter((a) => {
    const asset = storyAssets.find((s) => s.id === a.asset_id);
    return asset?.mime_type.startsWith("image/");
  });

  function openLightbox(asset: StoryAsset) {
    const idx = imageAttachments.findIndex((a) => a.asset_id === asset.id);
    setLightboxIndex(idx >= 0 ? idx : null);
  }

  return (
    <>
      <div className={styles.picker}>
        <button className={styles.header} onClick={() => setOpen((v) => !v)}>
          <Paperclip size={12} />
          <span>{label}</span>
          {refAttachments.length > 0 && <span className={styles.badge}>{refAttachments.length}</span>}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {open && (
          <div className={styles.panel}>
            {loading ? (
              <p className={styles.hint}>Loading…</p>
            ) : refAttachments.length === 0 ? (
              <p className={styles.hint}>No reference files attached yet</p>
            ) : (
              <div className={styles.attachList}>
                {refAttachments.map((att) => {
                  const asset = storyAssets.find((a) => a.id === att.asset_id);
                  const isImage = asset?.mime_type.startsWith("image/");
                  return (
                    <div key={att.id} className={styles.attachItem}>
                      <button
                        className={styles.attachThumb}
                        onClick={() => isImage && asset && openLightbox(asset)}
                        style={{ cursor: isImage ? "zoom-in" : "default" }}
                        title={isImage ? "View full size" : undefined}
                      >
                        {isImage && asset ? (
                          <>
                            <img
                              src={api.assetFileUrl(asset.id)}
                              alt={asset.alt_text || asset.original_filename}
                              className={styles.attachImg}
                              loading="lazy"
                              decoding="async"
                            />
                            <span className={styles.attachZoom}>
                              <ZoomIn size={10} />
                            </span>
                          </>
                        ) : (
                          <FileText size={14} />
                        )}
                      </button>
                      <div className={styles.attachInfo}>
                        <span className={styles.attachName}>{asset?.original_filename ?? att.asset_id}</span>
                      </div>
                      <button onClick={() => detach(att.id)} className={styles.detachBtn} title="Remove">
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={openBrowser} disabled={browsing}>
                <ImageIcon size={12} />
                Browse library
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={12} />
                {uploading ? "Uploading…" : "Upload file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/plain"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </div>

            {browsing && (
              <div className={styles.browser}>
                <div className={styles.browserHeader}>
                  <span>Story media</span>
                  <button onClick={() => setBrowsing(false)} className={styles.closeBtn}>
                    <X size={12} />
                  </button>
                </div>
                {storyAssets.length === 0 ? (
                  <p className={styles.hint}>No assets uploaded yet</p>
                ) : (
                  <div className={styles.browserGrid}>
                    {storyAssets.map((asset) => {
                      const alreadyAttached = refAttachments.some((a) => a.asset_id === asset.id);
                      const isImage = asset.mime_type.startsWith("image/");
                      return (
                        <button
                          key={asset.id}
                          className={`${styles.browserItem} ${alreadyAttached ? styles.browserItemAttached : ""}`}
                          onClick={() => !alreadyAttached && attach(asset.id)}
                          title={alreadyAttached ? "Already attached" : `Attach: ${asset.original_filename}`}
                        >
                          <div className={styles.browserThumb}>
                            {isImage ? (
                              <img
                                src={api.assetFileUrl(asset.id)}
                                alt={asset.original_filename}
                                className={styles.browserImg}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <FileText size={18} />
                            )}
                          </div>
                          <span className={styles.browserName}>{asset.original_filename}</span>
                          {alreadyAttached && <span className={styles.browserCheck}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null &&
        (() => {
          const att = imageAttachments[lightboxIndex];
          const asset = att && storyAssets.find((a) => a.id === att.asset_id);
          if (!asset) return null;
          return (
            <Lightbox
              url={api.assetFileUrl(asset.id)}
              alt={asset.alt_text || asset.original_filename}
              filename={asset.original_filename}
              onClose={() => setLightboxIndex(null)}
              onPrev={lightboxIndex > 0 ? () => setLightboxIndex((i) => (i ?? 1) - 1) : undefined}
              onNext={
                lightboxIndex < imageAttachments.length - 1
                  ? () => setLightboxIndex((i) => (i ?? 0) + 1)
                  : undefined
              }
            />
          );
        })()}
    </>
  );
}
