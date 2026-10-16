import { readEventStream } from "../../../lib/ai/eventStream";
import { useState, useEffect, useRef } from "react";
import { Feather, RefreshCw, Copy, Check, Images, X } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { api } from "../../../api/client";
import AIModeWrapper from "../AIModeWrapper";
import KeptAnswerBar from "../kept/KeptAnswerBar";
import { useKeptAnswer } from "../kept/useKeptAnswer";
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

  // The description is kept on the scene, or the story (A7): the session shows it again, through
  // a restart, until it is cleared or asked again; Start over chooses images for a new one.
  const nodeId = session.context.nodeId;
  const kept = useKeptAnswer(
    storyId
      ? nodeId
        ? { storyId, type: "node", id: nodeId }
        : { storyId, type: "story", id: storyId }
      : null,
    "scene-atmosphere",
  );
  const keptText = typeof kept.answer?.data.text === "string" ? kept.answer.data.text : "";
  const keptIds = (kept.answer?.data.asset_ids as string[] | undefined) ?? [];
  const [choosing, setChoosing] = useState(false);
  const shownText = generating || streamText ? streamText : choosing ? "" : keptText;

  const imageAssets = assets.filter((a) => a.mime_type.startsWith("image/"));
  const hasResult = shownText.length > 0;

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
    const ids = selected.length ? selected : keptIds;
    const query = userQuery.trim() || (kept.answer?.data.user_query as string | undefined) || "";
    if (!storyId || ids.length === 0) return;
    setGenerating(true);
    setStreamText("");
    setError(null);
    abortRef.current = false;

    try {
      const res = await api.analyzeSceneAtmosphere(storyId, ids, nodeId ?? undefined, query || undefined);
      if (!res.body) throw new Error("No response body");

      const { error } = await readEventStream(res, {
        onToken: setStreamText,
        stop: () => abortRef.current,
      });
      if (error) throw new Error(error);
      if (await kept.reload()) {
        setStreamText("");
        setChoosing(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    abortRef.current = true;
    setStreamText("");
    setError(null);
    setGenerating(false);
    setChoosing(true);
    if (selected.length === 0) setSelected(keptIds);
  }

  async function copyResult() {
    await navigator.clipboard.writeText(shownText);
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
            <button className={styles.iconBtn} onClick={reset} title="Start over" aria-label="Start over">
              <X size={13} />
            </button>
          </div>
          <div className={styles.resultBody}>
            <p className={styles.resultText}>{shownText}</p>
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
            {!kept.answer && (
              <button className={styles.regenBtn} onClick={generate} disabled={generating} title="Regenerate">
                <RefreshCw size={13} className={generating ? styles.spinner : undefined} />
                Regenerate
              </button>
            )}
          </div>
          {kept.answer && !streamText && (
            <KeptAnswerBar
              answer={kept.answer}
              heading={session.title ?? "Scene atmosphere"}
              context={{ storyId, nodeId }}
              onAskAgain={() => void generate()}
              asking={generating}
              onClear={() => void kept.clear()}
            />
          )}
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
