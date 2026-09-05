import { useState, useEffect, useRef } from "react";
import { Feather, RefreshCw, Copy, Check, Images, X } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { api } from "../../../api/client";
import AIModeWrapper from "../AIModeWrapper";
import type { StoryAsset } from "../../../types";
import styles from "./SceneAtmosphereMode.module.css";

interface Props {
  session: AISession;
}

export default function SceneAtmosphereMode({ session }: Props) {
  const state = useAIModeState(session);
  const storyId = session.context.storyId ?? "";

  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<boolean>(false);

  const imageAssets = assets.filter((a) => a.mime_type.startsWith("image/"));
  const hasResult = streamText.length > 0;

  useEffect(() => {
    if (!storyId) return;
    setAssetsLoading(true);
    api
      .listAssets(storyId)
      .then((list) => setAssets(list))
      .catch(() => {})
      .finally(() => setAssetsLoading(false));
  }, [storyId]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  async function generate() {
    if (!storyId || selected.length === 0) return;
    setGenerating(true);
    setStreamText("");
    setError(null);
    abortRef.current = false;

    try {
      const nodeId = session.context.nodeId ?? undefined;
      const res = await api.analyzeSceneAtmosphere(storyId, selected, nodeId, userQuery.trim() || undefined);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        if (abortRef.current) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamText(accumulated);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed — try again.");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    abortRef.current = true;
    setStreamText("");
    setError(null);
    setGenerating(false);
  }

  async function copyResult() {
    await navigator.clipboard.writeText(streamText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  // --- Empty / no story ---
  if (!storyId) {
    return (
      <AIModeWrapper
        session={session}
        state={state}
        icon={Feather}
        title="Scene Atmosphere"
        hideSettings
        hideTokenBadge
      >
        <div className={styles.empty}>
          <Images size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Scene Atmosphere</p>
          <p className={styles.emptyHint}>Open a story workspace to use this tool.</p>
        </div>
      </AIModeWrapper>
    );
  }

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Feather}
      title="Scene Atmosphere"
      hideSettings
      hideTokenBadge
    >
      {/* Result view */}
      {hasResult ? (
        <div className={styles.resultWrap}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>Atmospheric description</span>
            <button className={styles.iconBtn} onClick={reset} title="Start over">
              <X size={13} />
            </button>
          </div>
          <div className={styles.resultBody}>
            <p className={styles.resultText}>{streamText}</p>
            {generating && <span className={styles.cursor} />}
          </div>
          <div className={styles.resultFooter}>
            <button
              className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
              onClick={copyResult}
              disabled={generating}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className={styles.regenBtn} onClick={generate} disabled={generating} title="Regenerate">
              <RefreshCw size={13} className={generating ? styles.spinner : undefined} />
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        /* Selection view */
        <div className={styles.selectionWrap}>
          {/* Image grid */}
          <div className={styles.sectionLabel}>
            Reference images
            <span className={styles.selectionCount}>{selected.length}/5</span>
          </div>

          {assetsLoading ? (
            <div className={styles.assetsLoading}>
              <RefreshCw size={14} className={styles.spinner} />
              <span>Loading images…</span>
            </div>
          ) : imageAssets.length === 0 ? (
            <div className={styles.noAssets}>
              <Images size={16} className={styles.noAssetsIcon} />
              <p>No images uploaded yet. Upload images to the Media Library first.</p>
            </div>
          ) : (
            <div className={styles.imageGrid}>
              {imageAssets.map((asset) => {
                const isSelected = selected.includes(asset.id);
                const isDisabled = !isSelected && selected.length >= 5;
                return (
                  <button
                    key={asset.id}
                    className={`${styles.imageThumb} ${isSelected ? styles.imageThumbSelected : ""} ${isDisabled ? styles.imageThumbDisabled : ""}`}
                    onClick={() => toggleSelect(asset.id)}
                    title={asset.original_filename}
                    disabled={isDisabled}
                  >
                    <img
                      src={api.assetFileUrl(asset.id)}
                      alt={asset.alt_text || asset.original_filename}
                      className={styles.thumbImg}
                    />
                    {isSelected && (
                      <div className={styles.selectedOverlay}>
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Optional query */}
          <div className={styles.sectionLabel}>
            Additional context <span className={styles.optional}>(optional)</span>
          </div>
          <textarea
            className={styles.queryInput}
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="e.g. Focus on the sense of unease… or describe this as a stormy night…"
            rows={3}
          />

          {/* Error */}
          {error && (
            <div className={styles.errorBox}>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {/* Generate button */}
          <button
            className={styles.generateBtn}
            onClick={generate}
            disabled={selected.length === 0 || generating}
          >
            {generating ? (
              <>
                <RefreshCw size={14} className={styles.spinner} />
                Generating…
              </>
            ) : (
              <>
                <Feather size={14} />
                Generate atmosphere
              </>
            )}
          </button>

          {selected.length === 0 && <p className={styles.hint}>Select at least one image above</p>}
        </div>
      )}
    </AIModeWrapper>
  );
}
