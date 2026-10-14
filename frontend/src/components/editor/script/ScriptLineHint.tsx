import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { nameForms } from "../../../lib/prose/syntax";
import { makeItTheirLine, spokenInAction } from "../../../lib/script/spokenInAction";
import { cueName } from "../../../lib/script/syntax";
import { useStoryStore } from "../../../stores/storyStore";
import { LineOffer } from "./LineOffer";
import styles from "./SceneSplitBar.module.css";

/**
 * A line written the prose way in a script's action, `"Run," Eleanor said.` (doc 25, D6): a
 * quiet offer to make it Eleanor's line of dialogue, never a change made by itself. One step,
 * so ⌘Z puts the action back as it was.
 */
export default function ScriptLineHint({ editor }: { editor: Editor }) {
  const characters = useStoryStore((s) => s.characters);
  const [kept, setKept] = useState<string[]>([]);
  const offer = lineOffer(editor, characters, kept);
  return (
    <LineOffer editor={editor} id="their-line" pos={offer?.at ?? null}>
      {offer && (
        <span className={styles.offer} role="status">
          <span>In a script, {offer.cue}&rsquo;s words go under their name</span>
          <button
            className={styles.action}
            onClick={() => {
              const tr = editor.state.tr;
              makeItTheirLine(tr, offer.base, offer.found);
              editor.view.dispatch(tr);
              editor.commands.focus();
            }}
          >
            Make it {offer.cue}&rsquo;s line
          </button>
          <button className={styles.action} onClick={() => setKept([...kept, offer.text])}>
            Keep as action
          </button>
        </span>
      )}
    </LineOffer>
  );
}

/** The action line at the cursor, when it holds a line written the prose way. */
function lineOffer(
  editor: Editor,
  characters: { name: string; aliases?: string[] | null }[],
  kept: string[],
) {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const block = $from.node(1);
  if (block.attrs.el && block.attrs.el !== "action") return null;
  const text = block.textBetween(0, block.content.size, "\n", "￼");
  if (kept.includes(text)) return null;
  const names = characters.flatMap((c) => [c.name, ...(c.aliases ?? [])].flatMap((n) => [...nameForms(n)]));
  const found = spokenInAction(text, names);
  if (!found) return null;
  return { at: $from.before(1), base: $from.start(1), cue: cueName(found.speaker), found, text };
}
