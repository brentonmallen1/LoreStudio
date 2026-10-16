import { streamAnswer } from "../../lib/ai/eventStream";
import { useState, useRef, useEffect } from "react";
import { Orbit, Loader } from "lucide-react";
import { api } from "../../api/client";
import AssistantRow from "../lorebook/AssistantRow";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";
import styles from "./PlanGuidance.module.css";
import { useAIAvailable } from "../../lib/mode";

/** The layers that are about a character: their guidance is kept on the character. */
const CHARACTER_LAYERS = new Set(["character_summary", "character_synopsis"]);

interface Props {
  storyId: string;
  layer: string;
  content: string;
  characterId?: string | null;
  /** What the step is called, for the conversation's title. */
  stepName?: string;
}

/**
 * A Plan step's guidance (A7): the step's one Assistant row asks, and the answer is kept on
 * the story (or the character, for a character's layer) and shown here until it is cleared or
 * asked again, through a restart. Nothing runs on its own when the step opens.
 */
export default function PlanGuidance({ storyId, layer, content, characterId, stepName }: Props) {
  const aiAvailable = useAIAvailable();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCharacter = !!characterId && CHARACTER_LAYERS.has(layer);
  const kept = useKeptAnswer(
    onCharacter ? { storyId, type: "character", id: characterId } : { storyId, type: "story", id: storyId },
    `snowflake-guidance:${layer}`,
  );
  const keptText = typeof kept.answer?.data.text === "string" ? kept.answer.data.text : "";

  useEffect(() => () => abortRef.current?.abort(), []);

  async function fetchGuidance() {
    if (!content.trim()) {
      setError("Write something first, then ask for guidance.");
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await api.getSnowflakeGuidance(
        storyId,
        layer,
        content,
        characterId,
        abortRef.current.signal,
      );
      if (!res.ok) {
        setError("Guidance request failed.");
        return;
      }
      const { error: streamError } = await streamAnswer(res, setText);
      if (streamError) setError(streamError);
      else if (await kept.reload()) setText("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Connection error.");
    } finally {
      setLoading(false);
    }
  }

  if (!aiAvailable) return null;

  const shown = loading || text ? text : keptText;
  if (!shown && !loading && !error) {
    return (
      <AssistantRow
        actions={[
          {
            label: "Get guidance on this answer",
            title: "The Assistant reads what you have written here and asks what it leaves open",
            onRun: () => void fetchGuidance(),
          },
        ]}
      />
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>
          <Orbit size={13} />
          Guidance
        </span>
      </div>

      <div className={styles.body}>
        {loading && !text && (
          <div className={styles.loading}>
            <Loader size={14} className={styles.spinner} />
            Reading what you wrote…
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {shown && <div className={styles.response}>{shown}</div>}
      </div>

      {kept.answer && !text ? (
        <KeptAnswerBar
          answer={kept.answer}
          heading={`Guidance: ${stepName ?? "Plan"}`}
          context={{ storyId, characterId: onCharacter ? (characterId ?? undefined) : undefined }}
          onAskAgain={() => void fetchGuidance()}
          asking={loading}
          onClear={() => void kept.clear()}
        />
      ) : (
        !loading && (
          <button className={styles.retryBtn} onClick={() => void fetchGuidance()}>
            Ask again
          </button>
        )
      )}
    </div>
  );
}
