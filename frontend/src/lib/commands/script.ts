/**
 * Screenplay commands (doc 25): make the line the cursor is in a scene heading, action, a
 * character cue, a parenthetical, dialogue or a transition, or (P8) a centred line or a lyric,
 * and speak a speech at the same time as the one before it. Offered while a script scene is
 * open. Kept apart from index.ts, which is at its size budget.
 */
import { Clapperboard } from "lucide-react";
import { commandRegistry } from "./registry";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import { useEditorBridge } from "../../stores/editorBridge";
import { toast } from "../../stores/toastStore";
import type { ScriptElement } from "../script/syntax";

const ELEMENTS: [keyof typeof SHORTCUTS, ScriptElement, string[]][] = [
  ["scriptHeading", "heading", ["slugline", "scene heading", "int", "ext", "location"]],
  ["scriptAction", "action", ["action", "description", "stage direction"]],
  ["scriptCue", "cue", ["character", "cue", "name", "speaker"]],
  ["scriptParen", "paren", ["parenthetical", "wryly", "beat", "direction"]],
  ["scriptDialogue", "dialogue", ["dialogue", "speech", "line"]],
  ["scriptTransition", "transition", ["transition", "cut to", "fade out", "dissolve"]],
];

for (const [key, el, keywords] of ELEMENTS) {
  commandRegistry.register({
    id: `script-element-${el}`,
    label: SHORTCUTS[key].label,
    keywords: ["script", "screenplay", "element", ...keywords],
    icon: Clapperboard,
    group: "Editor",
    shortcut: formatCombo(SHORTCUTS[key].combo),
    when: () => !!useEditorBridge.getState().scriptElement,
    action: () => useEditorBridge.getState().scriptElement?.(el),
  });
}

const OTHER: [ScriptElement, string, string[]][] = [
  ["centered", "Script: Centred line", ["centred", "centered", "the end", "title"]],
  ["lyric", "Script: Lyric", ["lyric", "song", "sing", "verse"]],
];

for (const [el, label, keywords] of OTHER) {
  commandRegistry.register({
    id: `script-element-${el}`,
    label,
    keywords: ["script", "screenplay", "element", ...keywords],
    icon: Clapperboard,
    group: "Editor",
    when: () => !!useEditorBridge.getState().scriptElement,
    action: () => useEditorBridge.getState().scriptElement?.(el),
  });
}

commandRegistry.register({
  id: "script-dual",
  label: "Script: Speak at the same time",
  keywords: ["script", "screenplay", "dual dialogue", "together", "overlap", "simultaneous", "both"],
  icon: Clapperboard,
  group: "Editor",
  when: () => !!useEditorBridge.getState().scriptDual,
  action: () => {
    const done = useEditorBridge.getState().scriptDual?.();
    if (done === "none")
      toast.info(
        "Put the cursor in a speech that follows another; the two are then spoken at the same time.",
      );
  },
});
