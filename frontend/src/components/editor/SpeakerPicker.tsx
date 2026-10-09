import type { ReactNode } from "react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import { slotVar } from "../../lib/colorSlots";
import type { SpeakerChoices } from "../../lib/dialogue/speakerChoices";
import type { Character } from "../../types";
import styles from "./SceneEditor.module.css";

/**
 * Who says this line? (doc 24, D17) The "Unknown" or "?" on a line in the Dialogue view
 * opens the cast, the scene's people first; choosing one tags that line in the prose.
 * Not the Assistant: the author picks, nothing is guessed, so it is in Writer mode too.
 */
export default function SpeakerPicker({
  label,
  trigger,
  choices,
  align,
  disabled,
  onPick,
}: {
  /** The trigger's accessible name; it holds the visible text ("Unknown"). */
  label: string;
  trigger: ReactNode;
  choices: SpeakerChoices;
  align: "start" | "end";
  disabled?: boolean;
  onPick: (character: Character) => void;
}) {
  const item = (c: Character, group: string): MenuItem => ({
    key: c.id,
    label: c.name,
    group,
    disabled,
    marker: <span className={styles.speakerDot} style={{ background: slotVar(c.color_slot) }} />,
    onSelect: () => onPick(c),
  });
  const items = [
    ...choices.inScene.map((c) => item(c, "In this scene")),
    ...choices.rest.map((c) => item(c, choices.inScene.length ? "The rest of the cast" : "The cast")),
  ];
  if (items.length === 0) return <>{trigger}</>;
  return (
    <PopoverMenu
      label={label}
      trigger={trigger}
      items={items}
      align={align}
      triggerClassName={styles.speakerPickerBtn}
    />
  );
}
