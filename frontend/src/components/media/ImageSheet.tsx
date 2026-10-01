import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, ZoomIn } from "lucide-react";
import { api } from "../../api/client";
import { sectionPath } from "../../lib/routes";
import { ago } from "../../lib/serverDate";
import type { StoryAsset } from "../../types";
import Lightbox from "./Lightbox";
import UsedBy from "./UsedBy";
import styles from "./ImageSheet.module.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One image (doc 13 P5): the picture large, what it shows, the author's note on it, and
 * where it is used. The caption and note save as you leave each field.
 */
export default function ImageSheet({
  storyId,
  asset,
  onChange,
}: {
  storyId: string;
  asset: StoryAsset;
  /** The saved image, or null once it is deleted. */
  onChange: (asset: StoryAsset | null) => void;
}) {
  const back = sectionPath(storyId, "compendium", "images");
  const [alt, setAlt] = useState(asset.alt_text);
  const [note, setNote] = useState(asset.description);
  const [zoom, setZoom] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = api.assetFileUrl(asset.id);

  async function save(data: { alt_text?: string; description?: string }) {
    if (
      (data.alt_text ?? asset.alt_text) === asset.alt_text &&
      (data.description ?? asset.description) === asset.description
    )
      return;
    try {
      onChange(await api.updateAsset(asset.id, data));
      setError(null);
    } catch {
      setError("That did not save. Try again in a moment.");
    }
  }

  async function remove() {
    try {
      await api.deleteAsset(asset.id);
      onChange(null);
    } catch {
      setError("The image could not be deleted.");
      setConfirming(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <Link to={back} className={styles.back}>
          <ArrowLeft size={13} aria-hidden /> All images
        </Link>
        <div className={styles.layout}>
          <button
            type="button"
            className={styles.figure}
            onClick={() => setZoom(true)}
            aria-label="View full size"
          >
            <img src={url} alt={asset.alt_text || asset.original_filename} />
            <span className={styles.zoom}>
              <ZoomIn size={13} aria-hidden />
            </span>
          </button>
          <div className={styles.side}>
            <h1 className={styles.title}>{asset.original_filename}</h1>
            <p className={styles.meta}>
              {formatBytes(asset.size_bytes)} · added {ago(asset.created_at)}
            </p>
            <label className={styles.field}>
              <span>What it shows</span>
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                onBlur={() => void save({ alt_text: alt })}
                placeholder="A caption; screen readers read it too"
              />
            </label>
            <label className={styles.field}>
              <span>Your note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => void save({ description: note })}
                placeholder="Why it is here, what it is for"
                rows={4}
              />
            </label>
            <UsedBy attachments={asset.attachments ?? []} />
            {(asset.attachments ?? []).length === 0 && (
              <p className={styles.meta}>
                Not used anywhere yet. A character or place can take it as its picture.
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.actions}>
              {confirming ? (
                <>
                  <span className={styles.meta}>
                    Delete this image? It goes from everything that uses it.
                  </span>
                  <button type="button" className={styles.danger} onClick={() => void remove()}>
                    Delete
                  </button>
                  <button type="button" className={styles.quiet} onClick={() => setConfirming(false)}>
                    Keep it
                  </button>
                </>
              ) : (
                <button type="button" className={styles.quiet} onClick={() => setConfirming(true)}>
                  <Trash2 size={13} aria-hidden /> Delete image
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {zoom && (
        <Lightbox
          url={url}
          alt={asset.alt_text}
          filename={asset.original_filename}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}
