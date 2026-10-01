import { useState, useRef, useEffect } from "react";
import {
  Compass,
  Tag,
  Loader,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Zap,
  BrainCircuit,
  User,
  AlertCircle,
} from "lucide-react";
import { api } from "../../api/client";
import type { BatchSuggestResponse, ProposedDialogueTag, SceneWithDialogueProposals } from "../../types";
import styles from "./AutoTagPanel.module.css";
import AIOnly from "../ai/AIOnly";

const AUTO_CONFIDENCE_THRESHOLD = 0.7;

interface Props {
  mode: "character" | "story";
  storyId: string;
  characterId?: string; // required when mode="character"
  characterName?: string; // display label for mode="character"
  characterNames?: string[];
  onApplied?: () => void;
  /** Open on this scene: scan at once and step to it (a Proposals "Tag them", doc 12 P5). */
  sceneId?: string;
}

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <span className={styles.confidence} title={`Confidence: ${Math.round(value * 100)}%`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`${styles.dot} ${i <= level ? styles.dotFilled : ""}`} />
      ))}
    </span>
  );
}

interface SpeakerInputProps {
  value: string;
  characterNames: string[];
  onChange: (val: string) => void;
}

function SpeakerInput({ value, characterNames, onChange }: SpeakerInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? characterNames.filter(
        (n) => n.toLowerCase().startsWith(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase(),
      )
    : characterNames;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className={styles.speakerCombo}>
      <input
        className={styles.speakerInput}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Speaker…"
      />
      {open && filtered.length > 0 && (
        <div className={styles.speakerDropdown}>
          {filtered.map((name) => (
            <button
              key={name}
              className={styles.speakerOption}
              onPointerDown={(e) => {
                e.preventDefault();
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AutoTagPanel({
  mode,
  storyId,
  characterId,
  characterName,
  characterNames = [],
  onApplied,
  sceneId,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [aiRefining, setAiRefining] = useState(false);
  const [data, setData] = useState<BatchSuggestResponse | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({}); // scene_id -> Set<proposal.id>
  const [editedSpeakers, setEditedSpeakers] = useState<Record<string, string>>({});

  async function scan() {
    setScanning(true);
    try {
      const result =
        mode === "character" && characterId
          ? await api.suggestDialogueTagsForCharacter(characterId)
          : await api.suggestDialogueTagsStoryWide(storyId);
      setData(result);
      setSceneIndex(Math.max(0, sceneId ? result.scenes.findIndex((s) => s.scene_id === sceneId) : 0));
      // In character mode pre-select all proposals (already filtered to this character).
      // In story mode pre-select only high-confidence ones.
      const scanThreshold = mode === "character" ? 0 : AUTO_CONFIDENCE_THRESHOLD;
      const preSelected: Record<string, Set<string>> = {};
      for (const scene of result.scenes) {
        preSelected[scene.scene_id] = new Set(
          scene.proposals.filter((p) => p.confidence >= scanThreshold).map((p) => p.id),
        );
      }
      setSelected(preSelected);
      setEditedSpeakers({});
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }

  async function handleAiRefine() {
    if (!currentScene) return;
    setAiRefining(true);
    try {
      const aiProposals = await api.aiSuggestDialogueSpeakers(currentScene.scene_id);
      // Filter to this character if in character mode
      const filtered =
        mode === "character" && characterName
          ? aiProposals.filter((p) => p.inferred_speaker?.toLowerCase() === characterName.toLowerCase())
          : aiProposals;

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.scene_id === currentScene.scene_id ? { ...s, proposals: filtered } : s,
          ),
          total_proposals: prev.total_proposals - currentScene.proposals.length + filtered.length,
        };
      });
      // Pre-select AI high-confidence ones for this scene
      setSelected((prev) => ({
        ...prev,
        [currentScene.scene_id]: new Set(
          filtered.filter((p) => p.confidence >= AUTO_CONFIDENCE_THRESHOLD).map((p) => p.id),
        ),
      }));
    } catch {
      // ignore
    } finally {
      setAiRefining(false);
    }
  }

  async function applyAuto() {
    if (!data) return;
    setApplying(true);
    try {
      const scenes = data.scenes
        .map((scene) => ({
          scene_id: scene.scene_id,
          tags: scene.proposals
            .filter((p) => p.confidence >= autoThreshold && resolvedSpeaker(p))
            .map((p) => ({ quote_content: p.quote_content, speaker_name: resolvedSpeaker(p)! })),
        }))
        .filter((s) => s.tags.length > 0);

      if (scenes.length) await api.applyDialogueTagsBatch(storyId, scenes);
      onApplied?.();
      await scan(); // refresh
    } finally {
      setApplying(false);
    }
  }

  async function applySelected() {
    if (!data) return;
    setApplying(true);
    try {
      const scenes = data.scenes
        .filter((s) => selected[s.scene_id]?.size)
        .map((scene) => ({
          scene_id: scene.scene_id,
          tags: scene.proposals
            .filter((p) => selected[scene.scene_id]?.has(p.id) && resolvedSpeaker(p))
            .map((p) => ({ quote_content: p.quote_content, speaker_name: resolvedSpeaker(p)! })),
        }))
        .filter((s) => s.tags.length > 0);

      if (scenes.length) await api.applyDialogueTagsBatch(storyId, scenes);
      onApplied?.();
      await scan(); // refresh
    } finally {
      setApplying(false);
    }
  }

  function resolvedSpeaker(p: ProposedDialogueTag): string | undefined {
    const edited = editedSpeakers[p.id];
    if (edited !== undefined) return edited || undefined;
    if (p.inferred_speaker) return p.inferred_speaker;
    // In character mode the speaker is fixed to this character in the UI
    if (mode === "character" && characterName) return characterName;
    return undefined;
  }

  function toggleAll(scene: SceneWithDialogueProposals) {
    const sceneSet = selected[scene.scene_id] ?? new Set<string>();
    const allSelected = sceneSet.size === scene.proposals.length;
    setSelected((prev) => ({
      ...prev,
      [scene.scene_id]: allSelected ? new Set() : new Set(scene.proposals.map((p) => p.id)),
    }));
  }

  function toggleOne(scene: SceneWithDialogueProposals, proposal: ProposedDialogueTag) {
    setSelected((prev) => {
      const next = { ...prev };
      const sceneSet = new Set(next[scene.scene_id] ?? []);
      if (sceneSet.has(proposal.id)) sceneSet.delete(proposal.id);
      else sceneSet.add(proposal.id);
      next[scene.scene_id] = sceneSet;
      return next;
    });
  }

  // In character mode every proposal is already confirmed as this character's dialogue,
  // so apply all of them regardless of confidence. In story mode keep the threshold.
  const autoThreshold = mode === "character" ? 0 : AUTO_CONFIDENCE_THRESHOLD;

  // Opened for one scene: scan straight away rather than waiting for the button.
  const opened = useRef(false);
  useEffect(() => {
    if (!sceneId || opened.current) return;
    opened.current = true;
    void scan();
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentScene = data?.scenes[sceneIndex];
  // Opened for one scene that has nothing left to tag: say so, rather than quietly
  // showing another scene as if it were the one asked for (doc 13 P4).
  const askedScene = sceneId && data && !data.scenes.some((sc) => sc.scene_id === sceneId);
  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0);
  const autoCount = data
    ? data.scenes.reduce(
        (sum, s) =>
          sum + s.proposals.filter((p) => p.confidence >= autoThreshold && resolvedSpeaker(p)).length,
        0,
      )
    : 0;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button onClick={scan} disabled={scanning || applying} className={styles.scanBtn}>
          {scanning ? <Loader size={12} className={styles.spinner} /> : <Compass size={12} />}
          {scanning ? "Scanning…" : data ? "Rescan" : "Find dialogue to tag"}
        </button>

        {data && data.total_proposals > 0 && (
          <>
            <button
              onClick={applyAuto}
              disabled={applying || scanning || autoCount === 0}
              className={styles.autoBtn}
              title={`Auto-apply ${autoCount} high-confidence proposals (≥70%)`}
            >
              <Zap size={12} />
              {applying ? "Applying…" : `Auto (${autoCount})`}
            </button>
          </>
        )}

        {askedScene && (
          <span className={styles.countBadge} role="status">
            Every line in that scene has a speaker now.
          </span>
        )}
        {data && (
          <span className={styles.countBadge}>
            {data.total_proposals === 0
              ? "No untagged dialogue found"
              : `${data.total_proposals} quote${data.total_proposals !== 1 ? "s" : ""} in ${data.scenes.length} scene${data.scenes.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {data && data.scenes.length > 0 && currentScene && (
        <div className={styles.browser}>
          <div className={styles.sceneNav}>
            <button
              className={styles.navBtn}
              onClick={() => setSceneIndex((i) => i - 1)}
              disabled={sceneIndex === 0}
            >
              <ChevronLeft size={13} />
            </button>
            <span className={styles.sceneTitle}>
              {currentScene.scene_title}
              <span className={styles.sceneCounter}>
                {" "}
                ({sceneIndex + 1}/{data.scenes.length})
              </span>
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setSceneIndex((i) => i + 1)}
              disabled={sceneIndex === data.scenes.length - 1}
            >
              <ChevronRight size={13} />
            </button>
            <AIOnly>
              <button
                onClick={handleAiRefine}
                disabled={aiRefining || applying}
                className={styles.aiBtn}
                title="Use AI to re-analyze this scene's dialogue speakers"
              >
                {aiRefining ? <Loader size={11} className={styles.spinner} /> : <BrainCircuit size={11} />}
                {aiRefining ? "Refining…" : "AI"}
              </button>
            </AIOnly>
          </div>

          <div className={styles.proposalHeader}>
            <span className={styles.proposalHint}>
              {mode === "character" && characterName
                ? `Quotes likely spoken by ${characterName}`
                : "Select quotes to tag"}
            </span>
            <button className={styles.selectAllBtn} onClick={() => toggleAll(currentScene)}>
              {(selected[currentScene.scene_id]?.size ?? 0) === currentScene.proposals.length ? (
                <>
                  <CheckSquare size={11} /> Deselect all
                </>
              ) : (
                <>
                  <Square size={11} /> Select all
                </>
              )}
            </button>
          </div>

          <div className={styles.proposals}>
            {currentScene.proposals.map((p) => {
              const isSelected = selected[currentScene.scene_id]?.has(p.id) ?? false;
              const speaker = resolvedSpeaker(p);
              return (
                <div key={p.id} className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}>
                  <div className={styles.cardTop}>
                    <button className={styles.checkbox} onClick={() => toggleOne(currentScene, p)}>
                      {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                    </button>
                    <blockquote className={styles.quote}>"{p.quote_content}"</blockquote>
                    <ConfidenceDots value={p.confidence} />
                  </div>
                  {p.source_excerpt && <p className={styles.excerpt}>{p.source_excerpt}</p>}
                  <div className={styles.cardBottom}>
                    <User size={11} className={styles.speakerIcon} />
                    {mode === "character" && characterName ? (
                      <span className={styles.speakerFixed}>{characterName}</span>
                    ) : (
                      <SpeakerInput
                        value={editedSpeakers[p.id] ?? p.inferred_speaker ?? ""}
                        characterNames={characterNames}
                        onChange={(val) => setEditedSpeakers((prev) => ({ ...prev, [p.id]: val }))}
                      />
                    )}
                    {!speaker && (
                      <span className={styles.noSpeaker}>
                        <AlertCircle size={11} /> No speaker
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalSelected > 0 && (
            <div className={styles.applyRow}>
              <button onClick={applySelected} disabled={applying || scanning} className={styles.applyBtn}>
                <Tag size={12} />
                {applying ? "Applying…" : `Apply selected (${totalSelected})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
