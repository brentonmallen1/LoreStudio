import { useState, useEffect, useRef } from "react";
import { Camera, X, Upload, FileText, Feather } from "lucide-react";
import { api } from "../../api/client";
import type { StoryAsset, AssetAttachment } from "../../types";
import styles from "./PortraitEditor.module.css";

export interface CharacterImageDescription {
  appearance: string;
  personality: string;
  voice: string;
  age_estimate: string;
  backstory_hints: string;
}

interface Props {
  storyId: string;
  objectType: string;
  objectId: string;
  placeholder: React.ReactNode;
  size?: number;
  /** Called with parsed AI description when "Generate from portrait" completes */
  onAnalyzeForCharacter?: (desc: CharacterImageDescription) => void;
}

export default function PortraitEditor({
  storyId,
  objectType,
  objectId,
  placeholder,
  size = 80,
  onAnalyzeForCharacter,
}: Props) {
  const [portraitAttachment, setPortraitAttachment] = useState<AssetAttachment | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [storyAssets, setStoryAssets] = useState<StoryAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!objectId) return;
    api
      .listAttachments(objectType, objectId)
      .then((attachments) => {
        const portrait = attachments.find((a) => a.role === "portrait") ?? null;
        setPortraitAttachment(portrait);
        setPortraitUrl(portrait ? api.assetFileUrl(portrait.asset_id) : null);
      })
      .catch(() => {});
  }, [objectType, objectId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setBrowsing(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function loadBrowser() {
    const assets = await api.listAssets(storyId);
    setStoryAssets(assets.filter((a) => a.mime_type.startsWith("image/")));
    setBrowsing(true);
  }

  async function setPortrait(assetId: string) {
    // Detach existing portrait if any
    if (portraitAttachment) {
      await api.detachAsset(portraitAttachment.id).catch(() => {});
    }
    const att = await api.attachAsset(assetId, objectType, objectId, "portrait");
    setPortraitAttachment(att);
    setPortraitUrl(api.assetFileUrl(assetId));
    setOpen(false);
    setBrowsing(false);
  }

  async function removePortrait() {
    if (!portraitAttachment) return;
    await api.detachAsset(portraitAttachment.id).catch(() => {});
    setPortraitAttachment(null);
    setPortraitUrl(null);
    setOpen(false);
  }

  async function handleUpload(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await api.uploadAsset(storyId, file);
      await setPortrait(asset.id);
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  }

  async function analyzeForCharacter() {
    if (!portraitAttachment || !onAnalyzeForCharacter) return;
    setAnalyzing(true);
    setOpen(false);
    try {
      const res = await api.analyzeImageForCharacter(portraitAttachment.asset_id);
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
      // Strip any markdown fencing the model may have added
      const json = raw.replace(/```(?:json)?\n?/g, "").trim();
      const parsed = JSON.parse(json) as CharacterImageDescription;
      onAnalyzeForCharacter(parsed);
    } catch (e) {
      console.error("Character analysis failed", e);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className={styles.wrap} ref={panelRef} style={{ width: size, height: size }}>
      {/* Portrait display */}
      <div className={styles.portrait} style={{ width: size, height: size }}>
        {portraitUrl ? (
          <img src={portraitUrl} alt="Portrait" className={styles.img} decoding="async" />
        ) : (
          <div className={styles.placeholder}>{placeholder}</div>
        )}
        {analyzing && (
          <div className={styles.analyzingOverlay}>
            <Feather size={16} className={styles.analyzingSpin} />
          </div>
        )}
        <button
          className={styles.editOverlay}
          onClick={() => setOpen((v) => !v)}
          title="Change portrait"
          disabled={analyzing}
        >
          <Camera size={16} />
        </button>
      </div>

      {/* Edit panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Portrait</span>
            <button
              className={styles.closeBtn}
              onClick={() => {
                setOpen(false);
                setBrowsing(false);
              }}
            >
              <X size={12} />
            </button>
          </div>

          {!browsing ? (
            <div className={styles.panelActions}>
              <button
                className={styles.actionBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : "Upload image"}
              </button>
              <button className={styles.actionBtn} onClick={loadBrowser}>
                <FileText size={13} />
                Browse library
              </button>
              {portraitUrl && onAnalyzeForCharacter && (
                <button
                  className={`${styles.actionBtn} ${styles.analyzeBtn}`}
                  onClick={analyzeForCharacter}
                  disabled={analyzing}
                  title="Use AI to generate character appearance/personality hints from this portrait"
                >
                  <Feather size={13} />
                  {analyzing ? "Analyzing…" : "Generate description"}
                </button>
              )}
              {portraitUrl && (
                <button className={`${styles.actionBtn} ${styles.removeBtn}`} onClick={removePortrait}>
                  <X size={13} />
                  Remove portrait
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </div>
          ) : (
            <div className={styles.browser}>
              <div className={styles.browserBar}>
                <span>{storyAssets.length} images</span>
                <button className={styles.closeBtn} onClick={() => setBrowsing(false)}>
                  Back
                </button>
              </div>
              {storyAssets.length === 0 ? (
                <p className={styles.browserEmpty}>No images in library yet</p>
              ) : (
                <div className={styles.browserGrid}>
                  {storyAssets.map((asset) => (
                    <button
                      key={asset.id}
                      className={`${styles.gridItem} ${portraitAttachment?.asset_id === asset.id ? styles.gridItemActive : ""}`}
                      onClick={() => setPortrait(asset.id)}
                      title={asset.original_filename}
                    >
                      <img
                        src={api.assetFileUrl(asset.id)}
                        alt={asset.original_filename}
                        className={styles.gridImg}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
