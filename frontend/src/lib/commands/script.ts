/**
 * Screenplay commands (doc 25): make the line the cursor is in a scene heading, action, a
 * character cue, a parenthetical, dialogue or a transition. Offered while a script scene is
 * open. Kept apart from index.ts, which is at its size budget.
 */
import { Clapperboard } from "lucide-react";
import { commandRegistry } from "./registry";
import { SHORTCUTS } from "../keyboard/shortcuts";
import { useEditorBridge } from "../../stores/editorBridge";
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
    shortcut: SHORTCUTS[key].combo,
    when: () => !!useEditorBridge.getState().scriptElement,
    action: () => useEditorBridge.getState().scriptElement?.(el),
  });
}
