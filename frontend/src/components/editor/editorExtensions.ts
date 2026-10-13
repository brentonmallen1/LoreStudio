import type { AnyExtension } from "@tiptap/core";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import Typography from "@tiptap/extension-typography";
import type { StoryFormat } from "../../types";
import { proseStarterKit } from "./starterKit";
import { InlineNoteExtension } from "../story/InlineNoteExtension";
import { InlineImageExtension } from "../story/InlineImageExtension";
import { MentionDropdownExtension } from "../story/MentionDropdown";
import { DialogueExtension } from "../story/DialogueExtension";
import { SlashCommandExtension } from "../story/SlashCommandExtension";
import { SearchAndReplaceExtension } from "../story/SearchAndReplaceExtension";
import { PassageFlashExtension } from "../story/PassageFlashExtension";
import { UnifiedUndoExtension } from "./UnifiedUndoExtension";
import { ScriptElementAttribute, ScriptKeys } from "./script/ScriptElementExtension";
import { ScriptComplete } from "./script/ScriptComplete";
import { ScriptGuide } from "./script/ScriptGuide";
import { LineOfferExtension } from "./script/LineOfferExtension";

/**
 * The scene editor's extensions for a story's format (doc 25). Both formats write with the
 * same gestures; a script adds its element keys, and leaves out what only prose wants:
 * Typography's smart quotes and arrows, and the quote-based dialogue colouring (a script's
 * speech is its cues).
 */
export function editorExtensions(format: StoryFormat): AnyExtension[] {
  const script = format !== "prose";
  return [
    proseStarterKit(),
    Placeholder.configure({
      placeholder:
        format === "stage_play"
          ? "Write what the audience sees. ^ gives someone a line."
          : script
            ? "Write what we see. ^ gives someone a line."
            : "Begin writing…",
    }),
    CharacterCount,
    ...(script
      ? [
          ScriptKeys.configure({ format }),
          ScriptGuide.configure({ format }),
          ScriptComplete.configure({ format }),
          LineOfferExtension,
        ]
      : [Typography]),
    ScriptElementAttribute,
    InlineNoteExtension,
    InlineImageExtension,
    MentionDropdownExtension,
    SlashCommandExtension,
    ...(script ? [] : [DialogueExtension]),
    SearchAndReplaceExtension,
    PassageFlashExtension,
    UnifiedUndoExtension,
  ];
}
