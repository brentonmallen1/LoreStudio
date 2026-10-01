import { Compass } from "lucide-react";
import { useAIStore, type AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { aiFeatureLabel } from "../../../lib/ai/features.generated";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import MentionComposer from "../shared/MentionComposer";
import styles from "./AnalysisResultMode.module.css";

/** Renders whatever shape an analysis returned, without a schema per feature. */
function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    return (
      <ul className={styles.list}>
        {value.map((item, i) => (
          <li key={i}>
            <Value value={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={styles.object}>
        {Object.entries(value as Record<string, unknown>).map(([key, v]) => {
          const rendered = <Value value={v} />;
          if (!rendered) return null;
          return (
            <div key={key} className={styles.field}>
              <span className={styles.key}>{key.replace(/_/g, " ")}</span>
              {rendered}
            </div>
          );
        })}
      </div>
    );
  }
  return <span className={styles.scalar}>{String(value)}</span>;
}

/**
 * An analysis, shown as a session (doc 06 §2.1).
 *
 * Page-level analyses used to render into a modal and disappear with it. Opening them
 * here gives every AI output one place to be found, with the conversation underneath for
 * "why did you flag that?" — and Chronicle keeps the permanent record either way.
 */
export default function AnalysisResultMode({ session }: { session: AISession }) {
  const { sendMessage, cancelStreaming, regenerate } = useAIStore();
  const state = useAIModeState(session);
  const result = session.result;

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    sendMessage(session.id, content, undefined, state.sessionParams);
    state.setInput("");
  }

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Compass}
      title={result ? aiFeatureLabel(result.feature) : "Analysis"}
      onTransparencyClick={() =>
        state.transparency.open(
          { context_type: "scene-chat", story_id: session.context.storyId, node_id: "__story__" },
          state.lastResponse.current,
          { feature: result?.feature ?? "", story_id: session.context.storyId },
        )
      }
    >
      {result && (
        <div className={styles.result}>
          <Value value={result.data} />
        </div>
      )}

      <MessageList
        messages={session.messages}
        streamingText={session.streamingText}
        streamingThinking={session.streamingThinking}
        isStreaming={session.isStreaming}
        onRegenerate={() => regenerate(session.id)}
        onSaveNote={state.saveToNotes}
        onShowCall={() =>
          state.transparency.open(
            { context_type: "scene-chat", story_id: session.context.storyId },
            state.lastResponse.current,
            state.callLookup,
          )
        }
        emptyText="Ask about any of this: why it was flagged, what to do about it, what it missed."
      />

      <MentionComposer
        sessionId={session.id}
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming}
        placeholder="Ask about this analysis…"
      />
    </AIModeWrapper>
  );
}
