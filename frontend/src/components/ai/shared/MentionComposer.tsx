import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import type { Twist } from "../../../types";
import { X } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import { sceneLeaves } from "../../../lib/planning/methods";
import { slotVar } from "../../../lib/colorSlots";
import { acceptMention, activeMention, candidates, type ActiveMention } from "../../../lib/ai/mentionTokens";
import type { MentionedRef } from "../../../types/mentions";
import ChatInput, { type ChatInputProps } from "./ChatInput";
import ThinkToggle from "./ThinkToggle";
import styles from "./MentionComposer.module.css";

const KIND_LABEL: Record<MentionedRef["kind"], string> = {
  character: "character",
  location: "place",
  scene: "scene",
  thread: "thread",
  twist: "twist",
};

/**
 * ChatInput plus @-mentions (doc 11 P6). Typing `@` opens a list of the story's characters,
 * places, scenes, threads and twists; choosing one leaves `@Name` in the text and adds a chip. The
 * chips are the session's `mentionedRefs`: every send adds them to the context the server
 * assembles on its own, and the transparency view shows them as "you @mentioned them".
 * They stay for the conversation until the author removes one.
 */
export default function MentionComposer({ sessionId, ...props }: ChatInputProps & { sessionId: string }) {
  const refs = useAIStore((s) => s.sessions.find((x) => x.id === sessionId)?.mentionedRefs) ?? EMPTY;
  const setMentionedRefs = useAIStore((s) => s.setMentionedRefs);
  const characters = useStoryStore((s) => s.characters);
  const locations = useStoryStore((s) => s.locations);
  const threads = useStoryStore((s) => s.threads);
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const scenes = useMemo(() => sceneLeaves(structure, template), [structure, template]);
  // Twists are not in the story store; the composer asks once per story (doc 18 C8).
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const [twists, setTwists] = useState<Twist[]>([]);
  useEffect(() => {
    if (storyId) api.listTwists(storyId).then(setTwists, () => setTwists([]));
  }, [storyId]);
  const slotById = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of characters) m.set(c.id, c.color_slot);
    for (const l of locations) m.set(l.id, l.color_slot);
    for (const t of threads) m.set(t.id, t.color_slot);
    for (const t of twists) m.set(t.id, t.color_slot);
    return m;
  }, [characters, locations, threads, twists]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [cursor, setCursor] = useState(0);
  const list = useMemo(
    () =>
      mention ? candidates(mention.query, { characters, locations, scenes, threads, twists }, refs) : [],
    [mention, characters, locations, scenes, threads, twists, refs],
  );

  function handleChange(value: string) {
    props.onChange(value);
    // The caret is where it will be once React has applied the value: the DOM already has it.
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const next = activeMention(value, caret);
    if (next?.start !== mention?.start) setCursor(0);
    setMention(next);
  }

  function accept(index: number) {
    const pick = list[index];
    if (!pick || !mention) return;
    const caret = textareaRef.current?.selectionStart ?? props.value.length;
    const { text, caret: at } = acceptMention(props.value, caret, mention, pick.label);
    props.onChange(text);
    setMentionedRefs(sessionId, [...refs, pick]);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!mention || list.length === 0) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % list.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + list.length) % list.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      accept(cursor);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
      return true;
    }
    return false;
  }

  const above = (
    <>
      {refs.length > 0 && (
        <div className={styles.chips} aria-label="In mind for this conversation">
          {refs.map((r) => (
            <span
              key={`${r.kind}:${r.id}`}
              className={styles.chip}
              title={`${r.label} (${KIND_LABEL[r.kind]}, @mentioned)`}
            >
              <span
                className={styles.dot}
                style={{ background: slotVar(slotById.get(r.id), "var(--color-ai)") }}
              />
              {r.label}
              <button
                type="button"
                className={styles.remove}
                aria-label={`Stop mentioning ${r.label}`}
                onClick={() =>
                  setMentionedRefs(
                    sessionId,
                    refs.filter((x) => x !== r),
                  )
                }
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {mention && list.length > 0 && (
        <ul className={styles.popover} role="listbox" aria-label="Mention">
          {list.map((c, i) => (
            <li
              key={`${c.kind}:${c.id}`}
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? styles.optionActive : styles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(i);
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <span
                className={styles.dot}
                style={{ background: slotVar(slotById.get(c.id), "var(--color-ai)") }}
              />
              <span className={styles.optionLabel}>{c.label}</span>
              <span className={styles.kind}>{KIND_LABEL[c.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <ChatInput
      {...props}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      above={above}
      textareaRef={textareaRef}
      hintLeft={props.hintLeft ?? "Shift+Enter for newline · @ to mention"}
      footerStart={<ThinkToggle sessionId={sessionId} />}
    />
  );
}

const EMPTY: MentionedRef[] = [];
