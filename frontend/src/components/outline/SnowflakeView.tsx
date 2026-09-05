import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Users, ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import SnowflakeLayerEditor, { CharacterLayerSelector } from "./SnowflakeLayerEditor";
import styles from "./SnowflakeView.module.css";

// ── Layer definitions ──────────────────────────────────────────────────────────

type LayerId = "sentence" | "paragraph" | "character_summary" | "synopsis" | "character_synopsis";

interface LayerDef {
  id: LayerId;
  label: string;
  description: string;
  perCharacter?: boolean;
}

const LAYERS: LayerDef[] = [
  {
    id: "sentence",
    label: "One-Sentence Summary",
    description: "The entire story in ~25 words. No character names.",
  },
  {
    id: "paragraph",
    label: "One-Paragraph Summary",
    description: "Five sentences: setup, three disasters, ending.",
  },
  {
    id: "character_summary",
    label: "Character Summaries",
    description: "Goal, motivation, conflict, and epiphany for each major character.",
    perCharacter: true,
  },
  {
    id: "synopsis",
    label: "One-Page Synopsis",
    description: "Each sentence of your paragraph expands into a full paragraph.",
  },
  {
    id: "character_synopsis",
    label: "Character Synopses",
    description: "Each character's full arc told in first person.",
    perCharacter: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLayerComplete(
  layerId: LayerId,
  story: { snowflake_sentence: string; snowflake_paragraph: string; snowflake_synopsis: string },
  characters: Character[],
): boolean {
  switch (layerId) {
    case "sentence":
      return story.snowflake_sentence.trim().length > 0;
    case "paragraph":
      return story.snowflake_paragraph.trim().length > 0;
    case "synopsis":
      return story.snowflake_synopsis.trim().length > 0;
    case "character_summary":
      return characters.length > 0 && characters.every((c) => c.snowflake_summary.trim().length > 0);
    case "character_synopsis":
      return characters.length > 0 && characters.every((c) => c.snowflake_synopsis.trim().length > 0);
  }
}

function charLayerCount(layer: LayerId, characters: Character[]): { done: number; total: number } {
  const total = characters.length;
  const done = characters.filter((c) =>
    layer === "character_summary"
      ? c.snowflake_summary.trim().length > 0
      : c.snowflake_synopsis.trim().length > 0,
  ).length;
  return { done, total };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  storyId: string;
  onSwitchToList: () => void;
}

export default function SnowflakeView({ storyId, onSwitchToList }: Props) {
  const { activeStory, setActiveStory, characters } = useStoryStore();
  const [expanded, setExpanded] = useState<LayerId | null>("sentence");
  const [selectedCharId, setSelectedCharId] = useState<string | null>(characters[0]?.id ?? null);

  if (!activeStory) return null;

  // ── Save handlers ────────────────────────────────────────────────────────

  async function saveStoryField(
    field: "snowflake_sentence" | "snowflake_paragraph" | "snowflake_synopsis",
    value: string,
  ) {
    const updated = await api.updateStory(storyId, { [field]: value });
    setActiveStory(updated);
  }

  async function saveCharField(
    charId: string,
    field: "snowflake_summary" | "snowflake_synopsis",
    value: string,
  ) {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    await api.updateCharacter(charId, { [field]: value });
    // Refresh characters from store — updateCharacter should trigger a store update upstream,
    // but we patch locally for immediate feedback
    useStoryStore.setState((s) => ({
      characters: s.characters.map((c) => (c.id === charId ? { ...c, [field]: value } : c)),
    }));
  }

  // ── Toggle ───────────────────────────────────────────────────────────────

  function toggle(id: LayerId) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? null;

  return (
    <div className={styles.view}>
      <p className={styles.intro}>
        Expand your story outward, one layer at a time. Each layer builds on the last.
      </p>

      <div className={styles.stepper}>
        {LAYERS.map((layer, idx) => {
          const complete = isLayerComplete(layer.id, activeStory, characters);
          const isOpen = expanded === layer.id;

          return (
            <div key={layer.id} className={`${styles.step} ${isOpen ? styles.stepOpen : ""}`}>
              {/* Step header */}
              <button className={styles.stepHeader} onClick={() => toggle(layer.id)} aria-expanded={isOpen}>
                <span className={`${styles.stepStatus} ${complete ? styles.complete : ""}`}>
                  {complete ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                </span>
                <span className={styles.stepNum}>{idx + 1}</span>
                <div className={styles.stepMeta}>
                  <span className={styles.stepLabel}>{layer.label}</span>
                  {layer.perCharacter && (
                    <span className={styles.stepSub}>
                      <Users size={10} />
                      {charLayerCount(layer.id, characters).done}/{charLayerCount(layer.id, characters).total}{" "}
                      characters
                    </span>
                  )}
                  {!layer.perCharacter && complete && (
                    <span className={styles.stepSubComplete}>Complete</span>
                  )}
                </div>
                <span className={styles.stepChevron}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </button>

              {/* Step body */}
              {isOpen && (
                <div className={styles.stepBody}>
                  <p className={styles.stepDesc}>{layer.description}</p>

                  {/* Per-character layers */}
                  {layer.perCharacter && (
                    <>
                      {characters.length === 0 ? (
                        <p className={styles.noChars}>No characters added to this story yet.</p>
                      ) : (
                        <>
                          <CharacterLayerSelector
                            characters={characters}
                            selectedId={selectedCharId}
                            onChange={setSelectedCharId}
                          />
                          {selectedChar && (
                            <SnowflakeLayerEditor
                              key={`${layer.id}-${selectedChar.id}`}
                              storyId={storyId}
                              layer={layer.id}
                              value={
                                layer.id === "character_summary"
                                  ? selectedChar.snowflake_summary
                                  : selectedChar.snowflake_synopsis
                              }
                              prevContent={
                                layer.id === "character_synopsis"
                                  ? selectedChar.snowflake_summary || undefined
                                  : activeStory.snowflake_paragraph || undefined
                              }
                              character={selectedChar}
                              onSave={(val) =>
                                saveCharField(
                                  selectedChar.id,
                                  layer.id === "character_summary"
                                    ? "snowflake_summary"
                                    : "snowflake_synopsis",
                                  val,
                                )
                              }
                              onClose={() => setExpanded(null)}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Story-level layers */}
                  {!layer.perCharacter && layer.id === "sentence" && (
                    <SnowflakeLayerEditor
                      storyId={storyId}
                      layer="sentence"
                      value={activeStory.snowflake_sentence}
                      onSave={(val) => saveStoryField("snowflake_sentence", val)}
                      onClose={() => setExpanded(null)}
                    />
                  )}
                  {!layer.perCharacter && layer.id === "paragraph" && (
                    <SnowflakeLayerEditor
                      storyId={storyId}
                      layer="paragraph"
                      value={activeStory.snowflake_paragraph}
                      prevContent={activeStory.snowflake_sentence || undefined}
                      onSave={(val) => saveStoryField("snowflake_paragraph", val)}
                      onClose={() => setExpanded(null)}
                    />
                  )}
                  {!layer.perCharacter && layer.id === "synopsis" && (
                    <SnowflakeLayerEditor
                      storyId={storyId}
                      layer="synopsis"
                      value={activeStory.snowflake_synopsis}
                      prevContent={activeStory.snowflake_paragraph || undefined}
                      onSave={(val) => saveStoryField("snowflake_synopsis", val)}
                      onClose={() => setExpanded(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Layer 6: Scene List */}
        <div className={styles.step}>
          <button className={styles.stepHeader} onClick={onSwitchToList}>
            <span className={styles.stepStatus}>
              <Circle size={15} />
            </span>
            <span className={styles.stepNum}>6</span>
            <div className={styles.stepMeta}>
              <span className={styles.stepLabel}>Scene List</span>
              <span className={styles.stepSub}>Switch to List View to build your outline</span>
            </div>
            <span className={styles.stepChevron}>
              <ArrowRight size={13} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
