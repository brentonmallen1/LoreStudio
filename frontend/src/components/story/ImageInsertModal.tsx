import { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import { api } from "../../api/client";
import type { StoryAsset } from "../../types";
import styles from "./ImageInsertModal.module.css";

interface Props {
  storyId: string;
  onInsert: (assetId: string, alt: string) => void;
  onClose: () => void;
}

export default function ImageInsertModal({ storyId, onInsert, onClose }: Props) {
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api
      .listAssets(storyId)
      .then((all) => setAssets(all.filter((a) => a.mime_type.startsWith("image/"))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  async function handleUpload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const asset = await api.uploadAsset(storyId, file);
        if (asset.mime_type.startsWith("image/")) {
          setAssets((prev) => [asset, ...prev]);
        }
      } catch (e) {
        console.error("Upload failed", e);
      }
    }
    setUploading(false);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Insert image</span>
          <div className={styles.headerActions}>
            <label className={styles.uploadBtn} title={uploading ? "Uploading…" : "Upload new image"}>
              <Upload size={12} />
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                disabled={uploading}
              />
            </label>
            <button aria-label="Close" className={styles.closeBtn} onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.hint}>Loading…</p>
          ) : assets.length === 0 ? (
            <p className={styles.hint}>No images in this story yet. Upload one above.</p>
          ) : (
            <div className={styles.grid}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  className={styles.item}
                  onClick={() => onInsert(asset.id, asset.alt_text || asset.original_filename)}
                  title={`Insert: ${asset.original_filename}`}
                >
                  <div className={styles.thumb}>
                    <img
                      src={api.assetFileUrl(asset.id)}
                      alt={asset.alt_text || asset.original_filename}
                      className={styles.thumbImg}
                    />
                  </div>
                  <span className={styles.name}>{asset.original_filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
