import { useState } from "react";
import { Tag, AtSign, Compass, ChevronDown, ChevronRight } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import AutoTagPanel from "../cleanup/AutoTagPanel";
import MentionReviewPanel from "../characters/MentionReviewPanel";
import styles from "./MaintenanceView.module.css";

interface Props {
  storyId: string;
}

export default function MaintenanceView({ storyId }: Props) {
  const { characters } = useStoryStore();
  const [openSection, setOpenSection] = useState<"dialogue" | "mentions" | null>(null);
  const [openMentionCharId, setOpenMentionCharId] = useState<string | null>(null);

  const characterNames = characters.map((c) => c.name);

  const sections = [
    {
      id: "dialogue" as const,
      label: "Dialogue Tagging",
      description:
        "Find and tag unattributed dialogue across all scenes · NLP + optional AI re-analysis per scene",
      hint: "Scans your manuscript for quoted text without an explicit speaker and infers who is speaking based on nearby character mentions. Use Auto to apply high-confidence suggestions instantly, or review and select manually. Click AI on any scene to re-analyze with the language model for better accuracy.",
      Icon: Tag,
      type: "nlp" as const,
    },
    {
      id: "mentions" as const,
      label: "Character Mentions",
      description: "Link untagged character name references throughout the manuscript",
      hint: "Finds occurrences of character names in prose that aren't linked. Select a character to review and tag their mentions.",
      Icon: AtSign,
      type: "nlp" as const,
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span
          className={styles.legendItem}
          style={{ "--type-color": "var(--color-nlp)" } as React.CSSProperties}
        >
          <span className={styles.legendDot} />
          Local NLP — fast, no AI required
        </span>
      </div>

      <div className={styles.cards}>
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          const typeColor = section.type === "nlp" ? "var(--color-nlp)" : "var(--color-ai)";

          return (
            <div
              key={section.id}
              className={styles.card}
              style={{ "--btn-color": typeColor } as React.CSSProperties}
            >
              <button
                className={styles.cardHeader}
                onClick={() => setOpenSection(isOpen ? null : section.id)}
              >
                <div className={styles.btnMain}>
                  <div className={styles.btnIcon}>
                    <section.Icon size={14} />
                  </div>
                  <div className={styles.btnBody}>
                    <span className={styles.btnLabel}>{section.label}</span>
                    <span className={styles.btnDesc}>{section.description}</span>
                  </div>
                </div>
                <Compass size={16} className={styles.typeCompass} />
                <span className={styles.chevron}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </button>

              {isOpen && (
                <div className={styles.cardBody}>
                  <p className={styles.hint}>{section.hint}</p>

                  {section.id === "dialogue" && (
                    <AutoTagPanel mode="story" storyId={storyId} characterNames={characterNames} />
                  )}

                  {section.id === "mentions" && (
                    <div className={styles.characterList}>
                      {characters.map((c) => (
                        <div key={c.id} className={styles.characterCard}>
                          <button
                            className={styles.characterRow}
                            onClick={() => setOpenMentionCharId((prev) => (prev === c.id ? null : c.id))}
                          >
                            <span className={styles.characterName}>{c.name}</span>
                            {openMentionCharId === c.id ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </button>
                          {openMentionCharId === c.id && (
                            <div className={styles.mentionPanel}>
                              <MentionReviewPanel characterId={c.id} characterName={c.name} />
                            </div>
                          )}
                        </div>
                      ))}
                      {characters.length === 0 && (
                        <p className={styles.empty}>No characters found in this story.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
