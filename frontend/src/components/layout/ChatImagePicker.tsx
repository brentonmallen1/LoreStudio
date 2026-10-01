/**
 * ChatImagePicker — attach an image to a chat message.
 *
 * Two modes:
 *   - Browse: pick from existing story assets (images only)
 *   - Upload: choose a new file — gets saved to the media library AND included in the message
 *
 * Returns base64 image data via onSelect. The asset_id is also provided so
 * callers can display attribution or link back to the media library.
 */
import { useState, useRef, useEffect } from "react";
import { ImagePlus, X, Upload, Search, Check } from "lucide-react";
import { api } from "../../api/client";
import type { StoryAsset } from "../../types";
import styles from "./ChatImagePicker.module.css";

interface SelectedImage {
  base64: string;
  mimeType: string;
  filename: string;
  assetId?: string;
}

interface Props {
  storyId: string;
  selected: SelectedImage | null;
  onSelect: (img: SelectedImage | null) => void;
  disabled?: boolean;
}

async function assetToBase64(assetId: string): Promise<{ base64: string; mimeType: string }> {
  const url = api.assetFileUrl(assetId);
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/png;base64,XXXX" — strip the prefix
      const [header, data] = result.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? blob.type;
      resolve({ base64: data, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const data = result.split(",")[1];
      resolve(data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatImagePicker({ storyId, selected, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingAssets(true);
    api
      .listAssets(storyId)
      .then((all) => setAssets(all.filter((a) => a.mime_type.startsWith("image/"))))
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false));
  }, [open, storyId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function pickAsset(asset: StoryAsset) {
    const { base64, mimeType } = await assetToBase64(asset.id);
    onSelect({ base64, mimeType, filename: asset.original_filename, assetId: asset.id });
    setOpen(false);
  }

  async function handleUpload(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to media library
      const asset = await api.uploadAsset(storyId, file);
      // Also encode for immediate chat use
      const base64 = await fileToBase64(file);
      onSelect({ base64, mimeType: file.type, filename: file.name, assetId: asset.id });
      setOpen(false);
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  }

  const filteredAssets = query
    ? assets.filter((a) =>
        (a.original_filename + " " + (a.alt_text ?? "") + " " + (a.description ?? ""))
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : assets;

  return (
    <div className={styles.root} ref={panelRef}>
      {/* Trigger button — shows thumbnail if image selected */}
      {selected ? (
        <div className={styles.selectedThumb}>
          <img
            src={`data:${selected.mimeType};base64,${selected.base64}`}
            alt={selected.filename}
            className={styles.thumbImg}
          />
          <button
            className={styles.clearBtn}
            onClick={() => onSelect(null)}
            title="Remove image"
            disabled={disabled}
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          className={styles.triggerBtn}
          onClick={() => setOpen((v) => !v)}
          title="Attach image"
          disabled={disabled}
        >
          <ImagePlus size={14} />
        </button>
      )}

      {/* Picker panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${mode === "browse" ? styles.tabActive : ""}`}
                onClick={() => setMode("browse")}
              >
                Media library
              </button>
              <button
                className={`${styles.tab} ${mode === "upload" ? styles.tabActive : ""}`}
                onClick={() => setMode("upload")}
              >
                Upload new
              </button>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              <X size={12} />
            </button>
          </div>

          {mode === "browse" && (
            <div className={styles.browseMode}>
              <div className={styles.searchRow}>
                <Search size={12} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="Filter images…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {loadingAssets ? (
                <p className={styles.hint}>Loading…</p>
              ) : filteredAssets.length === 0 ? (
                <p className={styles.hint}>
                  {assets.length === 0 ? "No images in media library yet." : "No images match your filter."}
                </p>
              ) : (
                <div className={styles.grid}>
                  {filteredAssets.map((asset) => {
                    const isSelected = selected?.assetId === asset.id;
                    return (
                      <button
                        key={asset.id}
                        className={`${styles.gridItem} ${isSelected ? styles.gridItemSelected : ""}`}
                        onClick={() => pickAsset(asset)}
                        title={asset.original_filename}
                      >
                        <img
                          src={api.assetFileUrl(asset.id)}
                          alt={asset.alt_text || asset.original_filename}
                          className={styles.gridImg}
                        />
                        {isSelected && (
                          <div className={styles.gridCheck}>
                            <Check size={12} />
                          </div>
                        )}
                        <span className={styles.gridName}>{asset.original_filename}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mode === "upload" && (
            <div className={styles.uploadMode}>
              <p className={styles.uploadHint}>
                Upload a new image. It will be saved to your story's media library and attached to this
                message.
              </p>
              <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={14} />
                {uploading ? "Uploading…" : "Choose image"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
