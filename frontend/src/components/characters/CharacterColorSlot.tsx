import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import SlotPicker from "../common/SlotPicker";

/** The sheet's slot picker (doc 11 P2); saving goes through the store so every surface follows. */
export default function CharacterColorSlot({ character }: { character: Character }) {
  const upsertCharacter = useStoryStore((s) => s.upsertCharacter);
  return (
    <SlotPicker
      size="sm"
      value={character.color_slot}
      onChange={(slot) => api.updateCharacter(character.id, { color_slot: slot }).then(upsertCharacter)}
    />
  );
}
