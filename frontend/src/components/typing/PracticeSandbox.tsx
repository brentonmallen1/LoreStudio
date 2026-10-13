import { useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { RotateCcw } from "lucide-react";
import type { Character, Location } from "../../types";
import { editorExtensions } from "../editor/editorExtensions";
import { useMentionDropdown } from "../editor/useMentionDropdown";
import { useSlashCommands } from "../editor/useSlashCommands";
import { SlashPicker } from "../editor/SlashPicker";
import MentionDropdown from "../editor/MentionDropdown";
import Practice, { type PracticeStep } from "./Practice";
import { useTried } from "./useTried";
import editorStyles from "../editor/SceneEditor.module.css";
import styles from "./PracticeSandbox.module.css";

/**
 * The practice page's sandbox (doc 26, P5): a scrap of prose with a small cast and two places,
 * so `^`, `<`, `@`, `[[` and `/` all have something to work with, beside the steps they tick.
 * It is not a story: nothing here is saved, and a new name goes nowhere.
 */

const CAST = [
  { id: "practice-eleanor", name: "Eleanor", aliases: ["Eleanor Vance"], role: "protagonist", color_slot: 1 },
  { id: "practice-tom", name: "Tom", aliases: ["Tom Hale"], role: "supporting", color_slot: 2 },
] as Character[];

const PRACTICE = {
  places: [
    { id: "practice-lighthouse", name: "The Lighthouse", aliases: [], color_slot: 3 },
    { id: "practice-harbour", name: "The Harbour", aliases: [], color_slot: 4 },
  ] as unknown as Location[],
};

const STEPS: PracticeStep[] = [
  { id: "line", task: "Give someone a line" },
  { id: "tag", task: "Say who said “Run,” at the end of the text" },
  { id: "mention", task: "Name Eleanor or Tom" },
  { id: "place", task: "Name a place" },
  { id: "slash", task: "Choose a command from the menu" },
];

const START =
  "<p>The barometer had been falling since noon. Eleanor climbed to the lamp room and watched the harbour go still.</p>" +
  "<p>“Run,”</p>";

export default function PracticeSandbox() {
  const [round, setRound] = useState(0);
  const tried = useTried(round);
  const extensions = useMemo(
    () => editorExtensions("prose").filter((e) => e.name !== "inlineNote" && e.name !== "inlineImage"),
    [],
  );
  const editor = useEditor(
    {
      extensions,
      content: START,
      editorProps: { attributes: { "aria-label": "Practice text" } },
    },
    [round],
  );
  const mention = useMentionDropdown({
    editor,
    activeStory: null,
    characters: CAST,
    setCharacters: () => {},
    practice: PRACTICE,
  });
  const { slash } = useSlashCommands({
    editor,
    format: "prose",
    openDialoguePicker: mention.openDialoguePicker,
    addNote: () => {},
    insertImage: () => {},
    practice: true,
  });

  return (
    <div className={styles.sandbox}>
      <div className={styles.side}>
        <Practice steps={STEPS} tried={tried} />
        <button type="button" className={styles.again} onClick={() => setRound((r) => r + 1)}>
          <RotateCcw size={12} /> Start again
        </button>
      </div>
      <div
        className={`${editorStyles.editorWrap} ${styles.page}`}
        onClick={(e) => {
          if (editor && !(e.target as HTMLElement).closest(".ProseMirror")) editor.commands.focus("end");
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <SlashPicker slash={slash} />
      <MentionDropdown mention={mention} />
    </div>
  );
}
