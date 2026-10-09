import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { toast } from "../../stores/toastStore";
import type { AssetAttachment, DiagramSummary, StoryAsset } from "../../types";
import DiagramThumbnail from "../media/DiagramThumbnail";
import Lightbox from "../media/Lightbox";
import styles from "./SceneSheet.module.css";

/**
 * The Scene sheet's Images page (doc 24, canvas 8e): the pictures that set the scene, as a
 * grid. Add one (choose a file or drop it on the tile), or pick one the story already has;
 * a diagram drawn for a place shows here when it is attached to this scene.
 */
export default function SceneImages({
  storyId,
  nodeId,
  diagrams,
  onDiagram,
}: {
  storyId: string;
  nodeId: string;
  diagrams: DiagramSummary[];
  onDiagram: () => void;
}) {
  const [attached, setAttached] = useState<AssetAttachment[]>([]);
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listAttachments("structure_node", nodeId)
      .then(setAttached)
      .catch(() => setAttached([]));
    api
      .listAssets(storyId)
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [storyId, nodeId]);

  const images = attached
    .filter((a) => a.role !== "portrait")
    .flatMap((a) => {
      const asset = assets.find((s) => s.id === a.asset_id);
      return asset?.mime_type.startsWith("image/") ? [{ att: a, asset }] : [];
    });
  const others = assets.filter(
    (s) => s.mime_type.startsWith("image/") && !attached.some((a) => a.asset_id === s.id),
  );

  async function attach(assetId: string) {
    const att = await api.attachAsset(assetId, "structure_node", nodeId, "reference");
    setAttached((prev) => [...prev.filter((a) => a.id !== att.id), att]);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        const asset = await api.uploadAsset(storyId, f);
        setAssets((prev) => [asset, ...prev]);
        await attach(asset.id);
      } catch {
        toast.error(`“${f.name}” was not added.`);
      }
    }
    setBusy(false);
  }

  async function detach(att: AssetAttachment) {
    await api.detachAsset(att.id);
    setAttached((prev) => prev.filter((a) => a.id !== att.id));
  }

  return (
    <div className={styles.images}>
      <div className={styles.imageGrid}>
        {images.map(({ att, asset }, i) => (
          <figure key={att.id} className={styles.image}>
            <button type="button" className={styles.imageBtn} onClick={() => setShown(i)}>
              <img src={api.assetFileUrl(asset.id)} alt={asset.alt_text || asset.original_filename} />
            </button>
            <button
              type="button"
              className={styles.imageRemove}
              aria-label={`Take ${asset.original_filename} off this scene`}
              onClick={() => void detach(att)}
            >
              <X size={13} aria-hidden />
            </button>
          </figure>
        ))}
        {diagrams.map((d) => (
          <DiagramThumbnail key={d.id} diagram={d} onClick={onDiagram} />
        ))}
        <button
          type="button"
          className={`${styles.addTile} ${over ? styles.addTileOver : ""}`}
          onClick={() => file.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(e.dataTransfer.files);
          }}
          disabled={busy}
        >
          <Plus size={20} aria-hidden />
          <span>{busy ? "Adding…" : "Add an image"}</span>
          <span className={styles.muted}>or drop one here</span>
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />

      {others.length > 0 && (
        <button type="button" className={styles.addStep} onClick={() => setPicking((p) => !p)}>
          {picking ? "Done choosing" : `Choose from the story’s images · ${others.length}`}
        </button>
      )}
      {picking && (
        <div className={styles.imageGrid}>
          {others.map((a) => (
            <button
              key={a.id}
              type="button"
              className={styles.imageBtn}
              onClick={() => void attach(a.id)}
              title={`Add ${a.original_filename} to this scene`}
            >
              <img src={api.assetFileUrl(a.id)} alt={a.alt_text || a.original_filename} />
            </button>
          ))}
        </div>
      )}

      {images.length === 0 && diagrams.length === 0 && (
        <p className={styles.hint}>
          Pictures that set the scene: references, a mood board, a plan of the room. A diagram drawn for a
          place shows here when it is attached to this scene.
        </p>
      )}

      {shown !== null && images[shown] && (
        <Lightbox
          url={api.assetFileUrl(images[shown].asset.id)}
          alt={images[shown].asset.alt_text || images[shown].asset.original_filename}
          filename={images[shown].asset.original_filename}
          onClose={() => setShown(null)}
          onPrev={shown > 0 ? () => setShown(shown - 1) : undefined}
          onNext={shown < images.length - 1 ? () => setShown(shown + 1) : undefined}
        />
      )}
    </div>
  );
}
