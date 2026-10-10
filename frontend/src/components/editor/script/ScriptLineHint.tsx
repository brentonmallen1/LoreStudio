import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { nameForms } from "../../../lib/prose/syntax";
import { makeItTheirLine, spokenInAction } from "../../../lib/script/spokenInAction";
import { cueName } from "../../../lib/script/syntax";
import { useStoryStore } from "../../../stores/storyStore";
import banner from "../DraftBanner.module.css";
import styles from "./SceneSplitBar.module.css";

/**
 * A line written the prose way in a script's action, `"Run," Eleanor said.` (doc 25, D6): a
 * quiet offer to make it Eleanor's line of dialogue, never a change made by itself. One step,
 * so ⌘Z puts the action back as it was.
 */
export default function ScriptLineHint({ editor }: { editor: Editor }) {
  const characters = useStoryStore((s) => s.characters);
  const [kept, setKept] = useState<string[]>([]);
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const block = $from.node(1);
  if (block.attrs.el && block.attrs.el !== "action") return null;
  const text = block.textBetween(0, block.content.size, "\n", "￼");
  if (kept.includes(text)) return null;
  const names = characters.flatMap((c) => [c.name, ...(c.aliases ?? [])].flatMap((n) => [...nameForms(n)]));
  const found = spokenInAction(text, names);
  if (!found) return null;
  const base = $from.start(1);
  const cue = cueName(found.speaker);

  return (
    <div className={styles.bar} role="status">
      <span>Make this {cue}&rsquo;s line? In a script, a character&rsquo;s words go under their name.</span>
      <span className={banner.actions}>
        <button
          className={banner.btn}
          onClick={() => {
            const tr = editor.state.tr;
            makeItTheirLine(tr, base, found);
            editor.view.dispatch(tr);
            editor.commands.focus();
          }}
        >
          Make it {cue}&rsquo;s line
        </button>
        <button className={banner.btn} onClick={() => setKept([...kept, text])}>
          Keep as action
        </button>
      </span>
    </div>
  );
}
