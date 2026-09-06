import { Check, Feather, FileText, Users } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";
import { useAIAvailable } from "../../lib/mode";
import styles from "./StoryIdentityPanel.module.css";

// Small presentational pieces used by StoryIdentityPanel.

export function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len > max;
  return (
    <span className={`${styles.charCount} ${over ? styles.charCountOver : ""}`}>
      {len}/{max}
    </span>
  );
}

// ── Section group label ────────────────────────────────────────────────────
export function GroupLabel({ label, description }: { label: string; description: string }) {
  return (
    <div className={styles.groupLabel}>
      <span className={styles.groupLabelText}>{label}</span>
      <span className={styles.groupLabelDesc}>{description}</span>
    </div>
  );
}

// ── Completion dots ────────────────────────────────────────────────────────
export function CompletionDots({ filled, total }: { filled: number; total: number }) {
  return (
    <span className={styles.completionDots}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`${styles.dot} ${i < filled ? styles.dotFilled : ""}`} />
      ))}
    </span>
  );
}

// ── Hero stats bar ─────────────────────────────────────────────────────────
export function HeroStats(_props: { storyId: string }) {
  const { characters, structure, activeStory } = useStoryStore();
  const goals = activeStory?.goals ?? [];
  const completedGoals = goals.filter((g) => g.completed).length;

  // Count leaf nodes (scenes) in structure tree
  function countScenes(nodes: import("../../types").StructureNode[]): number {
    let count = 0;
    for (const n of nodes) {
      if (!n.children || n.children.length === 0) count++;
      else count += countScenes(n.children);
    }
    return count;
  }
  const sceneCount = countScenes(structure);

  return (
    <div className={styles.heroStats}>
      <div className={styles.heroStat}>
        <Users size={13} className={styles.heroStatIcon} />
        <span className={styles.heroStatValue}>{characters.length}</span>
        <span className={styles.heroStatLabel}>{characters.length === 1 ? "character" : "characters"}</span>
      </div>
      <div className={styles.heroStatDivider} />
      <div className={styles.heroStat}>
        <FileText size={13} className={styles.heroStatIcon} />
        <span className={styles.heroStatValue}>{sceneCount}</span>
        <span className={styles.heroStatLabel}>{sceneCount === 1 ? "scene" : "scenes"}</span>
      </div>
      {goals.length > 0 && (
        <>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <Check size={13} className={styles.heroStatIcon} />
            <span className={styles.heroStatValue}>
              {completedGoals}/{goals.length}
            </span>
            <span className={styles.heroStatLabel}>goals</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Workshop launcher button ───────────────────────────────────────────────
export function WorkshopBtn({
  label,
  message,
  storyId,
}: {
  label: string;
  message: string;
  storyId: string;
}) {
  const { createSession, sendMessage } = useAIStore();
  const aiAvailable = useAIAvailable();

  async function launch() {
    const session = await createSession("story-identity-workshop", { storyId });
    sendMessage(session.id, message);
  }

  if (!aiAvailable) return null;

  return (
    <button className={styles.workshopBtn} onClick={launch}>
      <Feather size={12} />
      {label}
    </button>
  );
}
