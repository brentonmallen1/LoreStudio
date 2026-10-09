import { slotVar } from "../../lib/colorSlots";
import { useStoryStore } from "../../stores/storyStore";
import type { EntityKind } from "../../types/panel";
import { KIND_COLOR } from "./tabColors";

/** The colour a thing is drawn in: its palette slot when it has one, else its kind's colour. */
export function entityColor(kind: EntityKind, id: string): string {
  const { characters, locations, threads } = useStoryStore.getState();
  const slot =
    kind === "character"
      ? characters.find((c) => c.id === id)?.color_slot
      : kind === "location"
        ? locations.find((l) => l.id === id)?.color_slot
        : kind === "thread"
          ? threads.find((t) => t.id === id)?.color_slot
          : undefined;
  return slotVar(slot, KIND_COLOR[kind]);
}
