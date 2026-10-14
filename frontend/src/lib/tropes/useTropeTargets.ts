import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { CharacterRelationship } from "../../types";
import type { TropeLink, TropeLinkTarget } from "../../types/tropes";
import { sceneLeaves } from "../planning/methods";

const RELOAD_ON = ["character_relationship", "character"] as const;

export interface TropeTarget {
  key: string;
  label: string;
  target: TropeLinkTarget;
}

/**
 * Where a trope can play (doc 27): the story's characters, the relationships between them and
 * its scenes, each with the words a chip shows. Relationships are fetched; the rest is in the
 * store already.
 */
export function useTropeTargets(storyId: string | undefined) {
  const characters = useStoryStore((s) => s.characters);
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const load = useCallback(
    () =>
      storyId
        ? api.listStoryRelationships(storyId).then(setRelationships, () => setRelationships([]))
        : Promise.resolve(),
    [storyId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnUndo(RELOAD_ON, load);

  return useMemo(() => {
    const name = new Map(characters.map((c) => [c.id, c.name]));
    const scenes = sceneLeaves(structure, template);
    const sceneTitle = new Map(scenes.map((n) => [n.id, n.title || "Untitled scene"]));
    const pair = (r: CharacterRelationship) =>
      `${name.get(r.character_id) ?? "?"} and ${name.get(r.related_character_id) ?? "?"}`;
    const relName = new Map(relationships.map((r) => [r.id, pair(r)]));

    const groups: { label: string; items: TropeTarget[] }[] = [
      {
        label: "Characters",
        items: characters.map((c) => ({ key: `c:${c.id}`, label: c.name, target: { character_id: c.id } })),
      },
      {
        label: "Relationships",
        items: relationships.map((r) => ({
          key: `r:${r.id}`,
          label: pair(r),
          target: { relationship_id: r.id },
        })),
      },
      {
        label: "Scenes",
        items: scenes.map((n) => ({
          key: `n:${n.id}`,
          label: n.title || "Untitled scene",
          target: { node_id: n.id },
        })),
      },
    ];

    /** A link's place in words, or null when what it named is gone. */
    function linkLabel(link: TropeLink): string | null {
      if (link.character_id) return name.get(link.character_id) ?? null;
      if (link.relationship_id) return relName.get(link.relationship_id) ?? null;
      if (link.node_id) return sceneTitle.get(link.node_id) ?? null;
      return null;
    }

    const linkKey = (link: TropeLink) =>
      link.character_id
        ? `c:${link.character_id}`
        : link.relationship_id
          ? `r:${link.relationship_id}`
          : `n:${link.node_id}`;

    /** The relationships a character is in, so their sheet shows the tropes those carry. */
    const relationshipsOf = (characterId: string) =>
      relationships
        .filter((r) => r.character_id === characterId || r.related_character_id === characterId)
        .map((r) => r.id);

    return { groups, linkLabel, linkKey, relationshipsOf };
  }, [characters, structure, template, relationships]);
}
