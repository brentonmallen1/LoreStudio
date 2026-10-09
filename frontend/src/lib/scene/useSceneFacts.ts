import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { SceneSetting, Story, StructureNode } from "../../types";
import { whoIsHere, type Present } from "./glance";

export interface SceneFacts {
  who: Present[];
  where: { name: string; role: string }[];
  beat: { name: string; position_pct: number } | null;
  when: string | null;
}

/**
 * Who, where, which beat and when, for the scene at a glance (doc 24 D19): the This scene tab
 * and the Scene sheet's card read them the same way. `refresh` changes when the places may have
 * changed (the sheet's Who, where, when page edits them), to read them again.
 */
export function useSceneFacts(node: StructureNode, story: Story, refresh: unknown = 0): SceneFacts {
  const { characters, locations, sceneCast, beatSheets } = useStoryStore();
  const [places, setPlaces] = useState<SceneSetting[]>([]);
  useEffect(() => {
    api
      .getSceneSettingsForNode(node.id)
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [node.id, refresh]);

  const pov = node.pov_character_id ?? story.pov_character_id;
  const castIds = sceneCast?.scenes.find((s) => s.node_id === node.id)?.character_ids ?? [];
  const where = places.flatMap((s) => {
    const loc = locations.find((l) => l.id === s.location_id);
    return loc ? [{ name: loc.name, role: s.role }] : [];
  });
  const beat =
    beatSheets.find((b) => b.id === story.beat_sheet_id)?.beats.find((b) => b.id === node.beat_id) ?? null;
  return {
    who: whoIsHere(pov, castIds, characters),
    where,
    beat,
    when: node.in_world_date?.trim() || null,
  };
}
